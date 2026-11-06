"""Read-only round-one public H5/API acceptance. Credentials and tokens never enter reports."""
import argparse,json,os,re,urllib.request,urllib.error,urllib.parse
from pathlib import Path
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self,*args,**kwargs):return None
p=argparse.ArgumentParser();p.add_argument('--base-url',required=True);p.add_argument('--accounts',required=True);p.add_argument('--report',required=True);args=p.parse_args()
origin=urllib.parse.urlsplit(args.base_url)
if origin.scheme!='https' or origin.hostname!='yc-test.yoki.ink' or origin.path not in ('','/') or origin.query or origin.fragment: p.error('Only the authorized yc-test HTTPS origin is allowed')
accounts=json.loads(Path(args.accounts).read_text());results=[];base=args.base_url.rstrip('/')
client=urllib.request.build_opener(urllib.request.ProxyHandler({}),NoRedirect())
def raw(path,data=None,account=None,token=None,method=None):
    headers={'content-type':'application/json'}
    if account:headers['tenant-id']=str(account['tenantId'])
    if token:headers['Authorization']='Bearer '+token
    request=urllib.request.Request((base+path) if path.startswith('/') else path,data=None if data is None else json.dumps(data).encode(),headers=headers,method=method)
    try:response=client.open(request,timeout=30)
    except urllib.error.HTTPError as error:response=error
    with response:return response.status,dict(response.headers),response.read()
def api(path,data=None,account=None,token=None,method=None):
    status,headers,body=raw('/admin-api'+path,data,account,token,method)
    try:body=json.loads(body)
    except ValueError:body={}
    return status,body

def check(name,predicate,**metadata):
    try:passed=bool(predicate())
    except Exception as e:passed=False;metadata['exceptionType']=type(e).__name__
    results.append({'name':name,'passed':passed,**metadata});print(name, 'PASS' if passed else 'FAIL',flush=True)
    return passed

def success(response):return 200<=response[0]<300 and response[1].get('code')==0
def denied(response):return response[0] in (401,403,404) or response[1].get('code') not in (None,0)
def login(a):
    response=api('/system/auth/login',{'username':a['username'],'password':a['password']},a)
    if not success(response):raise RuntimeError('login rejected')
    return response[1]['data']

tokens=[]
try:
    status,headers,html=raw('/')
    check('https-index',lambda:status==200 and b'<div id="app">' in html)
    check('index-no-store',lambda:'no-store' in headers.get('Cache-Control',''))
    s,h,_=raw('http://yc-test.yoki.ink/')
    check('http-redirects-to-https',lambda:s in (301,308) and h.get('Location','').startswith('https://yc-test.yoki.ink/'))
    check('version-origin',lambda:json.loads(raw('/version.json')[2])['application']=='yc-h5')
    asset=re.search(rb'src="(/assets/[^\"]+\.js)"',html)
    if asset:
        s,h,body=raw(asset.group(1).decode());check('hashed-js-asset',lambda:s==200 and 'javascript' in h.get('Content-Type','') and len(body)>1000)
        check('hashed-asset-immutable',lambda:'immutable' in h.get('Cache-Control',''))
    for path in ['/.env','/.git/config','/actuator/env','/swagger-ui/index.html']:
        response=raw(path);check('private-path-denied-'+path,lambda response=response:response[0] in (403,404))
    check('anonymous-identity-denied',lambda:denied(api('/system/auth/get-permission-info')))
    boss=accounts['boss']
    check('tenant-name-resolution',lambda:str(api('/system/tenant/get-id-by-name?'+urllib.parse.urlencode({'name':boss['tenant']}))[1].get('data'))==str(boss['tenantId']))
    check('wrong-password-denied',lambda:denied(api('/system/auth/login',{'username':boss['username'],'password':'intentional-invalid-round1-password'},boss)))
    boss_login=login(boss);token=boss_login['accessToken'];tokens.append((boss,token))
    check('boss-login',lambda:bool(token))
    check('boss-identity',lambda:success(api('/system/auth/get-permission-info',account=boss,token=token)))
    check('boss-employee-scope',lambda:success(api('/system/auth/get-mobile-permission-info',account=boss,token=token)))
    check('boss-management-departments',lambda:success(api('/sport/boss/departments',account=boss,token=token)))
    resources={'inventory':'/sport/boss/records/inventory','funds':'/sport/boss/records/funds','business':'/sport/boss/records/business','commission':'/sport/boss/records/commission','costs':'/sport/boss/catalog/costs','materials':'/sport/boss/catalog/materials','users':'/system/boss/directory/users','roles':'/system/boss/directory/roles','attendance':'/sport/boss/schedules'}
    for name,path in resources.items():
        response=api(path+'/page?pageNo=1&pageSize=20',account=boss,token=token)
        check('boss-'+name+'-list',lambda r=response:success(r) and isinstance(r[1].get('data',{}).get('list'),list))
        rows=response[1].get('data',{}).get('list',[])
        if rows:
            row=rows[0];check('boss-'+name+'-string-id',lambda row=row:isinstance(row.get('id'),str))
            detail=api(path+'/get?'+urllib.parse.urlencode({'id':row['id']}),account=boss,token=token)
            check('boss-'+name+'-detail',lambda r=detail,row=row:success(r) and str(r[1].get('data',{}).get('id'))==str(row['id']))
    date=boss['closedDate'];query=urllib.parse.urlencode({'schemaVersion':2,'start':date,'end':date,'deptId':boss['deptId']})
    report=api('/sport/boss/reports?'+query,account=boss,token=token)
    check('boss-closed-day-report',lambda:success(report) and report[1]['data'].get('schemaVersion')==2 and any(day.get('status')=='FRESH' for store in report[1]['data']['stores'] for day in store['days']))
    check('boss-platform-tenants-denied',lambda:denied(api('/system/admin-native/platform/tenants/page?pageNo=1&pageSize=20',account=boss,token=token)))
    check('invalid-date-range-rejected',lambda:denied(api('/sport/boss/reports?schemaVersion=2&start=2026-11-07&end=2026-11-01',account=boss,token=token)))
    employee=accounts['employee'];worker=login(employee)['accessToken'];tokens.append((employee,worker))
    check('employee-identity',lambda:success(api('/system/auth/get-permission-info',account=employee,token=worker)))
    check('employee-scope',lambda:success(api('/system/auth/get-mobile-permission-info',account=employee,token=worker)))
    check('employee-settings-denied',lambda:denied(api('/system/boss/business-settings',account=employee,token=worker)))
    check('employee-platform-denied',lambda:denied(api('/system/admin-native/platform/tenants/page?pageNo=1&pageSize=20',account=employee,token=worker)))
    other=accounts['other'];other_token=login(other)['accessToken'];tokens.append((other,other_token))
    foreign=api('/sport/boss/records/funds/page?pageNo=1&pageSize=20',account=other,token=other_token)
    rows=foreign[1].get('data',{}).get('list',[])
    if rows:
        leaked=api('/sport/boss/records/funds/get?'+urllib.parse.urlencode({'id':rows[0]['id']}),account=boss,token=token)
        check('cross-tenant-record-denied',lambda:denied(leaked))
    changed={**boss,'tenantId':other['tenantId']}
    check('token-tenant-mismatch-denied',lambda:denied(api('/system/auth/get-permission-info',account=changed,token=token)))
    root=accounts['platform'];root_token=login(root)['accessToken'];tokens.append((root,root_token))
    check('platform-tenant-list',lambda:success(api('/system/admin-native/platform/tenants/page?pageNo=1&pageSize=20',account=root,token=root_token)))
    check('platform-employee-scope',lambda:success(api('/system/auth/get-mobile-permission-info',account=root,token=root_token)))
    check('logout-success',lambda:success(api('/system/auth/logout',{},boss,token)))
    check('logged-out-token-revoked',lambda:denied(api('/system/auth/get-permission-info',account=boss,token=token)))
except Exception as e:
    results.append({'name':'round-execution','passed':False,'exceptionType':type(e).__name__})
finally:
    for a,t in tokens:
        try:api('/system/auth/logout',{},a,t)
        except Exception:pass
    report={'checks':results,'passed':all(x['passed'] for x in results),'total':len(results),'passedCount':sum(x['passed'] for x in results)}
    fd=os.open(args.report,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as out:json.dump(report,out,indent=2,ensure_ascii=False)
    print(json.dumps({'total':report['total'],'passed':report['passedCount'],'failed':[x['name'] for x in results if not x['passed']]},ensure_ascii=False))
