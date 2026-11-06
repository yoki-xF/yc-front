"""Exercise one explicitly synthetic closed-day correction, retaining the exact command for retry."""
import argparse, json, os, urllib.error, urllib.parse, urllib.request, uuid
from decimal import Decimal
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--account', required=True)
parser.add_argument('--state', required=True)
parser.add_argument('--report', required=True)
parser.add_argument('--execute-synthetic-writes', action='store_true')
args = parser.parse_args()
if not args.execute_synthetic_writes: parser.error('Explicit synthetic write flag required')
account = json.loads(Path(args.account).read_text())
if account.get('tenant') != '营业日验收7abfafce' or str(account.get('deptId')) != '139':
    parser.error('Only the designated synthetic full-UI fixture is allowed')
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs): return None
client = urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
token = None
checks = []
def call(path, data=None, public=False):
    headers={'content-type':'application/json'}
    if not public: headers.update({'tenant-id':str(account['tenantId']),'Authorization':'Bearer '+token})
    req=urllib.request.Request('https://yc-test.yoki.ink/admin-api'+path,data=None if data is None else json.dumps(data).encode(),headers=headers)
    try: response=client.open(req,timeout=30)
    except urllib.error.HTTPError as error: response=error
    with response: body=json.load(response)
    if body.get('code') != 0: raise RuntimeError('API rejected synthetic exercise')
    return body.get('data')
def check(name,passed):
    checks.append({'name':name,'passed':bool(passed)})
    print(name,'PASS' if passed else 'FAIL',flush=True)
    if not passed: raise RuntimeError('Synthetic acceptance check failed')
try:
    login=call('/system/auth/account-login',{'account':account['boss'],'password':account['password']},True)
    check('login-bound-fixture',login.get('tenantId')==str(account['tenantId']) and login.get('tenantName')==account['tenant'])
    token=login['accessToken']
    row=call('/sport/boss/records/funds/get?id=67')
    check('fixture-record-scope',row.get('id')=='67' and row.get('deptId')=='139' and row.get('classes')=='Late' and str(row.get('checkTime','')).startswith('2026-11-06'))
    path=Path(args.state)
    if path.exists():
        command=json.loads(path.read_text())
        check('same-persisted-command',command.get('type')=='funds' and command.get('id')=='67' and command.get('fields')=={'xj':'131.00'} and command.get('reason')=='H5合成验收更正现金录入错误')
    else:
        check('initial-cash-expected',Decimal(row['xj'])==Decimal('130.00') and row.get('correctionSupported') is True)
        command={'type':'funds','id':'67','revision':row['revision'],'reason':'H5合成验收更正现金录入错误','requestKey':str(uuid.uuid4()),'fields':{'xj':'131.00'},'lines':[]}
        preview=call('/sport/boss/corrections/preview',command)
        check('preview-recomputes-closed-report',preview.get('revision')==command['revision'] and Decimal(preview['beforeReport']['variance'])==0 and Decimal(preview['afterReport']['variance'])==1)
        path.parent.mkdir(parents=True,exist_ok=True)
        with path.open('x') as stream: json.dump(command,stream)
        path.chmod(0o600)
    receipt=call('/sport/boss/corrections/apply',command)
    check('correction-receipt',receipt.get('status')=='APPLIED' and receipt.get('recordId')=='67' and bool(receipt.get('auditId')) and Decimal(receipt['report']['variance'])==1)
    retry=call('/sport/boss/corrections/apply',command)
    check('same-request-is-idempotent',retry==receipt)
    after=call('/sport/boss/records/funds/get?id=67')
    check('record-cash-readback',Decimal(after['xj'])==131)
    history=call('/sport/boss/corrections/history?type=funds&id=67')
    check('single-audit-entry',sum(x['id']==receipt['auditId'] for x in history)==1)
    query=urllib.parse.urlencode({'schemaVersion':2,'start':'2026-11-06','end':'2026-11-06','deptId':'139'})
    report=call('/sport/boss/reports?'+query)
    day=report['stores'][0]['days'][0]
    check('closed-report-reconciled',day['status']=='FRESH' and day['closed'] is True and Decimal(day['variance'])==1 and Decimal(day['totalSales'])==30)
except Exception as error:
    checks.append({'name':'execution','passed':False,'exceptionType':type(error).__name__})
finally:
    if token:
        try: call('/system/auth/logout',{})
        except Exception: pass
    out=Path(args.report); out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps({'checks':checks,'passed':sum(x['passed'] for x in checks),'total':len(checks)},indent=2))
raise SystemExit(0 if checks and all(x['passed'] for x in checks) else 1)
