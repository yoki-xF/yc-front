"""Synthetic test-site login checks. Never records passwords or tokens."""
import argparse, json, urllib.error, urllib.request
from pathlib import Path
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--accounts', required=True)
parser.add_argument('--report', required=True)
args = parser.parse_args()
accounts = json.loads(Path(args.accounts).read_text())
class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs): return None
client = urllib.request.build_opener(urllib.request.ProxyHandler({}), NoRedirect())
base = 'https://yc-test.yoki.ink/admin-api'
checks, tokens = [], []
def call(path, body, tenant=None, token=None):
    headers = {'content-type':'application/json'}
    if tenant is not None: headers['tenant-id'] = str(tenant)
    if token: headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request(base + path, data=json.dumps(body).encode(), headers=headers, method='POST')
    try: response = client.open(request, timeout=30)
    except urllib.error.HTTPError as error: response = error
    with response: return json.load(response)
def check(name, passed):
    checks.append({'name':name,'passed':bool(passed)})
    print(name, 'PASS' if passed else 'FAIL', flush=True)
def keep(result, tenant):
    if result.get('code') == 0 and result.get('data',{}).get('accessToken'):
        tokens.append((str(tenant),result['data']['accessToken']))
def bound(result, account):
    data = result.get('data') or {}
    return result.get('code') == 0 and data.get('tenantId') == str(account['tenantId']) and isinstance(data.get('tenantName'),str) and bool(data['tenantName']) and bool(data.get('accessToken')) and bool(data.get('refreshToken'))
try:
    for role, account in accounts.items():
        legacy = call('/system/auth/login',{'username':account['username'],'password':account['password']},account['tenantId'])
        if legacy.get('code') != 0: raise RuntimeError('fixture legacy authentication failed')
        keep(legacy,account['tenantId'])
        canonical = 'yc-' + str(legacy['data']['userId'])
        result = call('/system/auth/account-login',{'account':canonical,'password':account['password']})
        check(role + '-canonical-bound-organization',bound(result,account)); keep(result,account['tenantId'])
        if role != 'platform':
            result = call('/system/auth/account-login',{'account':account['username'],'password':account['password']})
            check(role + '-username-bound-organization',bound(result,account)); keep(result,account['tenantId'])
        if role == 'boss':
            result = call('/system/auth/account-login',{'account':canonical,'password':account['password']},accounts['other']['tenantId'])
            check('caller-organization-cannot-override-binding',bound(result,account)); keep(result,account['tenantId'])
            wrong = call('/system/auth/account-login',{'account':canonical,'password':'invalid123'})
    absent = call('/system/auth/account-login',{'account':'unregisteredaccount2026','password':'invalid123'})
    check('credentials-error-does-not-expose-organization',wrong.get('code') != 0 and wrong.get('code') == absent.get('code') and wrong.get('msg') == absent.get('msg') and not wrong.get('data') and not absent.get('data'))
    overflow = call('/system/auth/account-login',{'account':'yc-9223372036854775808','password':'invalid123'})
    check('canonical-overflow-rejected-generically',overflow.get('code') == absent.get('code') and overflow.get('msg') == absent.get('msg'))
    malformed = call('/system/auth/account-login',{'account':'yc-0','password':'invalid123'})
    check('malformed-canonical-id-rejected',malformed.get('code') == 400)
except Exception as error:
    checks.append({'name':'execution','passed':False,'exceptionType':type(error).__name__})
finally:
    for tenant,token in tokens:
        try: call('/system/auth/logout',{},tenant,token)
        except Exception: pass
    path = Path(args.report); path.parent.mkdir(parents=True,exist_ok=True)
    path.write_text(json.dumps({'checks':checks,'passed':sum(x['passed'] for x in checks),'total':len(checks)},indent=2))
raise SystemExit(0 if checks and all(x['passed'] for x in checks) else 1)
