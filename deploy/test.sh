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
test "$(docker inspect --format '{{index .Config.Labels "com.docker.compose.project"}}' yc-acceptance-mysql)" = yc-acceptance
mkdir -p "$DEPLOY/backups" "$OPS"
chmod 700 "$OPS" "$DEPLOY/backups"
export YC_FRONT_SHA="$(git -C "$YC_FRONT_SOURCE" rev-parse HEAD)"
export YC_BACKEND_SHA="$(git -C "$YC_BACKEND_SOURCE" rev-parse HEAD)"
export YC_RELEASE="$(date -u +%Y%m%dT%H%M%SZ)"
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
result=subprocess.run(['docker','exec','yc-acceptance-mysql','sh','-c','MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysqldump -uroot --single-transaction --routines --triggers --databases yc_acceptance'],capture_output=True,check=True)
with gzip.open(p,'wb') as output:output.write(result.stdout)
p.chmod(0o600)
print('Test DB backup SHA256:',hashlib.sha256(p.read_bytes()).hexdigest())
PY
cp "$YC_BACKEND_SOURCE/compose.acceptance.yaml" "$DEPLOY/compose.yaml"
cp "$YC_FRONT_SOURCE/deploy/compose.test.yaml" "$DEPLOY/compose.h5-test.yaml"
compose() { docker compose --env-file "$DEPLOY/.env" -f "$DEPLOY/compose.yaml" -f "$DEPLOY/compose.h5-test.yaml" --profile app "$@"; }
compose config --quiet
cd "$YC_BACKEND_SOURCE"
JAVA_HOME=/opt/homebrew/opt/openjdk@21 mvn -s "$OPS/maven-settings.xml" -Dmaven.repo.local=/private/tmp/yc-maven-repository -Dmaven-surefire-plugin.version=3.5.6 -DskipTests=false -Dmaven.test.skip=false -DargLine=-javaagent:/private/tmp/yc-maven-repository/net/bytebuddy/byte-buddy-agent/1.14.19/byte-buddy-agent-1.14.19.jar package > "$OPS/backend-build-$YC_RELEASE.log" 2>&1
compose build backend web > "$OPS/docker-build-$YC_RELEASE.log" 2>&1
compose up -d --wait backend
# Recreate web after backend is healthy to refresh Nginx's upstream DNS resolution.
compose up -d --no-deps --force-recreate --wait web
curl --fail --silent http://127.0.0.1:15181/healthz
curl --fail --silent http://127.0.0.1:15181/version.json
