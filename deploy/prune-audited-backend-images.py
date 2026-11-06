#!/usr/bin/env python3
"""Remove only JAR-verified orphan YC backend images; preserve all references/rollback ancestors."""
import argparse, datetime, json, re, subprocess
from pathlib import Path
ops = Path('/Users/yoki/ServerData/operations/yc-test')
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--execute', action='store_true')
args = parser.parse_args()
def run(*command): return subprocess.check_output(command, text=True)
audit = json.loads((ops / 'orphan-backend-image-audit.json').read_text())
if datetime.datetime.now(datetime.timezone.utc) - datetime.datetime.fromisoformat(audit['createdAt']) > datetime.timedelta(hours=1):
    raise SystemExit('Audit older than one hour; rerun embedded JAR verification')
ids = list(dict.fromkeys(run('docker','image','ls','-aq','--no-trunc').split()))
images = {i['Id']:i for i in json.loads(run('docker','image','inspect',*ids))}
containers = run('docker','ps','-aq').split()
protected = {i['Image'] for i in json.loads(run('docker','inspect',*containers))} if containers else set()
protected.update(i['Id'] for i in images.values() if i.get('RepoTags') or i.get('RepoDigests'))
latest = {}
for path in sorted(ops.glob('before-*.json'), key=lambda p:p.stat().st_mtime):
    for name,image in json.loads(path.read_text()).get('images',{}).items():
        if name in {'yc-h5-test','yc-acceptance-backend'}: latest[name] = image
protected.update(latest.values())
for image in list(protected):
    parent = images.get(image,{}).get('Parent')
    while parent and parent not in protected:
        protected.add(parent); parent = images.get(parent,{}).get('Parent')
plan = [i for i in audit['matches'] if i['image'] in images and i['image'] not in protected
        and 'artifactId=yc-backend' in i['identity'] and 'groupId=cn.jxc.yc' in i['identity']]
plan.sort(key=lambda i:datetime.datetime.fromisoformat(re.sub(r'(\.\d{6})\d+',r'\1',i['created']).replace('Z','+00:00')), reverse=True)
report = {'mode':'execute' if args.execute else 'plan','plan':plan,'results':[]}
if args.execute:
    for item in plan:
        exists = subprocess.run(['docker','image','inspect',item['image']],capture_output=True)
        if exists.returncode: continue
        result = subprocess.run(['docker','image','rm',item['image']],capture_output=True,text=True)
        report['results'].append({'image':item['image'],'removed':result.returncode==0,'error':result.stderr.strip() if result.returncode else ''})
    (ops / ('audited-backend-cleanup-'+datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ')+'.json')).write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
