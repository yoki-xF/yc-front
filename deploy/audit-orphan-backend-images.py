#!/usr/bin/env python3
"""Identify unused YC backend images by the embedded JAR identity; plan only."""
import datetime, json, subprocess, tempfile, uuid, zipfile
from pathlib import Path

def run(*args):
    return subprocess.check_output(args, text=True).strip()

containers = run('docker', 'ps', '-aq').split()
used = {x['Image'] for x in json.loads(run('docker', 'inspect', *containers))} if containers else set()
ids = list(dict.fromkeys(run('docker', 'image', 'ls', '-aq', '--no-trunc').split()))
images = json.loads(run('docker', 'image', 'inspect', *ids))
matches = []
with tempfile.TemporaryDirectory(prefix='yc-image-audit-') as directory:
    for image in images:
        if image['Id'] in used or image.get('RepoTags') or image.get('RepoDigests'):
            continue
        if image.get('Config', {}).get('Entrypoint') != ['sh', '-c', 'exec java $JAVA_OPTS -jar /app/app.jar "$@"', '--']:
            continue
        name = 'yc-image-audit-' + uuid.uuid4().hex[:12]
        created = False
        try:
            run('docker', 'create', '--network', 'none', '--name', name, '--label', 'yc.audit=orphan-image', image['Id'])
            created = True
            jar = Path(directory) / 'app.jar'
            run('docker', 'cp', name + ':/app/app.jar', str(jar))
            with zipfile.ZipFile(jar) as archive:
                manifest = archive.read('META-INF/MANIFEST.MF').decode()
                identity = archive.read('META-INF/maven/cn.jxc.yc/yc-backend/pom.properties').decode()
            if 'Start-Class: cn.jxc.yc.YcApplication' in manifest and 'artifactId=yc-backend' in identity and 'groupId=cn.jxc.yc' in identity:
                matches.append({'image': image['Id'], 'created': image['Created'], 'size': image['Size'], 'identity': identity.strip()})
        except (subprocess.CalledProcessError, KeyError, zipfile.BadZipFile) as error:
            print('Skipped image audit:', image['Id'], type(error).__name__)
        finally:
            if created:
                run('docker', 'rm', name)
report = {'createdAt': datetime.datetime.now(datetime.timezone.utc).isoformat(), 'mode': 'plan-only', 'matches': matches}
path = Path('/Users/yoki/ServerData/operations/yc-test/orphan-backend-image-audit.json')
path.write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
