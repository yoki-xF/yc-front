#!/bin/bash
set -euo pipefail
# Run on Mac mini only; no production, schema reset, or SQL restore.
export PATH=/Users/yoki/.local/bin:/opt/homebrew/bin:/usr/bin:/bin:$PATH
export YC_FRONT_SOURCE=/Users/yoki/Projects/yc-front
export YC_BACKEND_SOURCE=/Users/yoki/Projects/yc-backend
DEPLOY=/Users/yoki/ServerData/deployments/yc-acceptance
OPS=/Users/yoki/ServerData/operations/yc-test
for repo in "$YC_FRONT_SOURCE" "$YC_BACKEND_SOURCE"; do
  test -z "$(git -C "$repo" status --porcelain)" || { echo "Dirty source: $repo" >&2; exit 1; }
  test "$(git -C "$repo" rev-parse HEAD)" = "$(git -C "$repo" rev-parse origin/main)" || { echo 'Source must match fetched origin/main' >&2; exit 1; }
done
for dependency in local-shared-mysql local-shared-redis; do
  test "$(docker inspect --format '{{.State.Running}}' "$dependency")" = true
  test "$(docker inspect --format '{{if index .NetworkSettings.Networks "yc-acceptance_isolated"}}yes{{end}}' "$dependency")" = yes || {
    echo "$dependency must be attached to yc-acceptance_isolated" >&2
    exit 1
  }
done
mkdir -p "$DEPLOY/backups" "$OPS"
chmod 700 "$OPS" "$DEPLOY/backups"
export YC_FRONT_SHA="$(git -C "$YC_FRONT_SOURCE" rev-parse HEAD)"
export YC_BACKEND_SHA="$(git -C "$YC_BACKEND_SOURCE" rev-parse HEAD)"
export YC_RELEASE="$(date -u +%Y%m%dT%H%M%SZ)"
export YC_SKIP_BACKEND="$(python3 - <<'CACHE'
import json,os,subprocess
from pathlib import Path
path=Path('/Users/yoki/ServerData/operations/yc-test/backend-release.json')
reuse=False
if path.exists():
    prior=json.loads(path.read_text())
    current=json.loads(subprocess.check_output(['docker','inspect','yc-acceptance-backend']))[0]
    reuse=prior.get('backendCommit')==os.environ['YC_BACKEND_SHA'] and prior.get('image')==current['Image'] and current['State'].get('Health',{}).get('Status')=='healthy'
print('1' if reuse else '0')
CACHE
)"
python3 - <<'CAPACITY'
import os,subprocess
lines=subprocess.check_output(['docker','exec','yc-acceptance-backend','df','-Pk','/'],text=True).splitlines()
free=int(lines[-1].split()[3]);required=64*1024 if os.environ['YC_SKIP_BACKEND']=='1' else 1024*1024
if free<required:raise SystemExit('Docker VM free disk below build requirement. Review deploy/prune-test-images.py plan; do not delete volumes or disable disk health checks.')
print('Docker VM available MiB:',free//1024,'backend reuse:',os.environ['YC_SKIP_BACKEND']=='1')
CAPACITY
python3 - <<'PY'
import gzip,hashlib,json,os,subprocess
from pathlib import Path
root=Path('/Users/yoki/ServerData/deployments/yc-acceptance')
ops=Path('/Users/yoki/ServerData/operations/yc-test')
images={}
for name in ['yc-h5-test','yc-acceptance-backend']:
    result=subprocess.run(['docker','inspect','--format','{{.Image}}',name],capture_output=True,text=True)
    if result.returncode==0:images[name]=result.stdout.strip()
(ops/('before-'+os.environ['YC_RELEASE']+'.json')).write_text(json.dumps({'images':images},indent=2))
p=root/'backups'/('before-'+os.environ['YC_RELEASE']+'.sql.gz')
result=subprocess.run(['docker','exec','local-shared-mysql','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --databases yc_acceptance'],capture_output=True,check=True)
with gzip.open(p,'wb') as output:output.write(result.stdout)
p.chmod(0o600)
print('Test DB backup SHA256:',hashlib.sha256(p.read_bytes()).hexdigest())
PY
for migration in 20261109_live_rooms.sql 20261111_mobile_activity_request.sql; do
  docker exec -i local-shared-mysql sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot yc_acceptance' < "$YC_BACKEND_SOURCE/sql/mysql/$migration"
done
cp "$YC_BACKEND_SOURCE/compose.acceptance.yaml" "$DEPLOY/compose.yaml"
cp "$YC_FRONT_SOURCE/deploy/compose.test.yaml" "$DEPLOY/compose.h5-test.yaml"
compose() { docker compose --env-file "$DEPLOY/.env" -f "$DEPLOY/compose.yaml" -f "$DEPLOY/compose.h5-test.yaml" --profile app "$@"; }
compose config --quiet
if test "$YC_SKIP_BACKEND" != 1; then
  cd "$YC_BACKEND_SOURCE"
  JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -s "${YC_MAVEN_SETTINGS:-$OPS/maven-settings.xml}" -Dmaven.repo.local=/private/tmp/yc-maven-repository -Dmaven-surefire-plugin.version=3.5.6 -DskipTests=false -Dmaven.test.skip=false -DargLine=-javaagent:/private/tmp/yc-maven-repository/net/bytebuddy/byte-buddy-agent/1.14.19/byte-buddy-agent-1.14.19.jar package > "$OPS/backend-build-$YC_RELEASE.log" 2>&1
  compose build backend > "$OPS/backend-docker-build-$YC_RELEASE.log" 2>&1
  compose up -d --wait backend
else
  echo 'Backend source and healthy running image match prior verified release; no backend rebuild or restart.'
fi
compose build web > "$OPS/docker-build-$YC_RELEASE.log" 2>&1
# Recreate web after backend is healthy to refresh Nginx's upstream DNS resolution.
compose up -d --no-deps --force-recreate --wait web
curl --fail --silent http://127.0.0.1:15181/healthz
curl --fail --silent http://127.0.0.1:15181/version.json

python3 - <<'RECEIPT'
import json,os,subprocess
from pathlib import Path
current=json.loads(subprocess.check_output(['docker','inspect','yc-acceptance-backend']))[0]
if current['State'].get('Health',{}).get('Status')!='healthy':raise SystemExit('Backend no longer healthy')
jar=subprocess.check_output(['docker','exec','yc-acceptance-backend','sha256sum','/app/app.jar'],text=True).split()[0]
receipt={'backendCommit':os.environ['YC_BACKEND_SHA'],'image':current['Image'],'jarSha256':jar,'verifiedRelease':os.environ['YC_RELEASE']}
root=Path('/Users/yoki/ServerData/operations/yc-test')
(root/'backend-release.json').write_text(json.dumps(receipt,indent=2))
(root/('release-'+os.environ['YC_RELEASE']+'.json')).write_text(json.dumps({**receipt,'frontendCommit':os.environ['YC_FRONT_SHA'],'backendReused':os.environ['YC_SKIP_BACKEND']=='1'},indent=2))
RECEIPT
