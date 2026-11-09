"""Cash idempotency checks against the authorized synthetic YC test environment only."""
import argparse,json,uuid,urllib.request,urllib.error,urllib.parse
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor
p=argparse.ArgumentParser();p.add_argument('--account',required=True);p.add_argument('--foreign-account',required=True);p.add_argument('--state',required=True);p.add_argument('--report',required=True);a=p.parse_args()
fixture=json.loads(Path(a.account).read_text());foreign=json.loads(Path(a.foreign_account).read_text())
client=urllib.request.build_opener(urllib.request.ProxyHandler({}));base='https://yc-test.yoki.ink/admin-api';checks=[];token=None

def api(path,data=None,method='GET',day=None):
 headers={'content-type':'application/json','tenant-id':str(fixture['tenantId'])}
 if token:headers['Authorization']='Bearer '+token
 if day:headers['X-Operating-Day']=day
 req=urllib.request.Request(base+path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
 try:r=client.open(req,timeout=30)
 except urllib.error.HTTPError as e:r=e
 with r:return json.load(r)
def ok(r):return r.get('code')==0
def check(name,yes):checks.append({'name':name,'passed':bool(yes)});print(name,'PASS' if yes else 'FAIL',flush=True)
def page(dept=None):return api('/sport/wx/cash-ledger/page?'+urllib.parse.urlencode({'deptId':dept or fixture['deptId'],'pageNo':1,'pageSize':50}))
try:
 login=api('/system/auth/account-login',{'account':fixture['username'],'password':fixture['password']},'POST')
 if not ok(login):raise RuntimeError('synthetic login failed')
 token=login['data']['accessToken'];dept=str(fixture['deptId'])
 state=Path(a.state)
 if state.exists():command=json.loads(state.read_text())
 else:
  current=api('/sport/wx/store/operating-day?deptId='+dept)
  if not ok(current) or current['data'].get('status')!='OPEN':raise RuntimeError('fixture business day not open')
  d=current['data'];day=d.get('operatingDayId') or d.get('id')
  if not day:raise RuntimeError('missing day id')
  command={'day':day,'payload':{'requestKey':str(uuid.uuid4()),'transfer':{'deptId':dept,'shiftAmount':'0.01','shiftSource':0,'remark':'H5 synthetic cash concurrency acceptance 20261109'}}}
  state.parent.mkdir(parents=True,exist_ok=True);state.write_text(json.dumps(command))
 payload=command['payload'];before=page();check('own-shared-ledger-readable',ok(before))
 count=lambda r:sum(x.get('remark')==payload['transfer']['remark'] for x in r.get('data',{}).get('list',[]))
 query=lambda body:api('/sport/wx/shift/to/amount/result',body,'POST')
 initial=query(payload);check('original-result-query-readable',ok(initial) and initial['data']['status'] in ('NOT_FOUND','APPLIED'))
 with ThreadPoolExecutor(max_workers=2) as pool:
  receipts=list(pool.map(lambda _:api('/sport/wx/shift/to/amount/safe-submit',payload,'POST',command['day']),range(2)))
 check('concurrent-identical-request-receipts',all(ok(r) and r['data'] is True for r in receipts))
 applied=query(payload);check('committed-original-query-applied',ok(applied) and applied['data']['status']=='APPLIED' and str(applied['data']['deptId'])==dept)
 after=page();check('concurrent-request-one-ledger-row',ok(after) and count(after)==1)
 check('exact-price-and-business-day',any(x.get('remark')==payload['transfer']['remark'] and x.get('price')=='0.01' and bool(x.get('businessDate')) for x in after.get('data',{}).get('list',[])))
 changed=json.loads(json.dumps(payload));changed['transfer']['shiftAmount']='0.02'
 check('changed-payload-same-key-rejected',not ok(api('/sport/wx/shift/to/amount/safe-submit',changed,'POST',command['day'])))
 check('changed-original-query-rejected',not ok(query(changed)))
 check('foreign-store-ledger-denied',not ok(page(foreign['deptId'])))
 changed['transfer']['deptId']=str(foreign['deptId']);check('foreign-store-result-denied',not ok(query(changed)))
 check('rejected-attempts-create-no-extra-row',count(page())==1)
 check('invalid-page-size-rejected',not ok(api('/sport/wx/cash-ledger/page?deptId='+dept+'&pageNo=1&pageSize=51')))
except Exception as e:checks.append({'name':'execution','passed':False,'exceptionType':type(e).__name__})
finally:
 if token:
  try:api('/system/auth/logout',{},'POST')
  except Exception:pass
 report=Path(a.report);report.parent.mkdir(parents=True,exist_ok=True);report.write_text(json.dumps({'checks':checks,'passed':sum(x['passed'] for x in checks),'total':len(checks)},indent=2))
raise SystemExit(0 if checks and all(x['passed'] for x in checks) else 1)
