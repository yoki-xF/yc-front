// Explicit opt-in integration against the isolated Docker backend; no WeChat upload or business writes.
const assert=require('node:assert/strict'),fs=require('node:fs'),cp=require('node:child_process')
const credentialFile=process.env.YC_ACCEPTANCE_CREDENTIALS_FILE
if(!credentialFile)throw Error('Set the private YC_ACCEPTANCE_CREDENTIALS_FILE for the isolated test environment')
const inspect=cp.spawnSync('docker',['inspect','--format','{{index .Config.Labels "com.docker.compose.project"}}','yc-acceptance-backend'],{encoding:'utf8'})
if(inspect.status!==0||inspect.stdout.trim()!=='yc-acceptance')throw Error('Only the dedicated yc-acceptance backend is allowed')
const credentials=JSON.parse(fs.readFileSync(credentialFile,'utf8')),storage=new Map(),checks=[]
function config(key,value){return key+' = '+JSON.stringify(String(value))+'\n'}
global.wx={getStorageSync:k=>storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),request(options){setImmediate(()=>{
 try{
  const url=new URL(options.url);if(url.origin!=='http://127.0.0.1:48080'||!url.pathname.startsWith('/admin-api/'))throw Error('Unexpected API origin')
  const method=options.method||'GET';let input=''
  if(method==='GET')for(const [key,value]of Object.entries(options.data||{})){
   if(Array.isArray(value))value.forEach((item,i)=>url.searchParams.append(key+'['+i+']',String(item)))
   else if(value!=null)url.searchParams.append(key,String(value))
  }
  input+=config('url',url.href)+config('request',method)
  for(const [key,value]of Object.entries(options.header||{}))input+=config('header',key+': '+value)
  if(method!=='GET'&&options.data!=null){const type=options.header?.['content-type']||'';input+=config('data',type.includes('urlencoded')?new URLSearchParams(options.data).toString():JSON.stringify(options.data))}
  input+=config('write-out','\n%{http_code}')
  const result=cp.spawnSync('docker',['exec','-i','yc-acceptance-backend','curl','--silent','--show-error','--max-time','30','--config','-'],{input,encoding:'utf8',maxBuffer:4*1024*1024})
  if(result.status!==0)throw Error('Isolated HTTP transport failed')
  const split=result.stdout.lastIndexOf('\n'),statusCode=Number(result.stdout.slice(split+1)),data=JSON.parse(result.stdout.slice(0,split))
  options.success({statusCode,data})
 }catch(_){options.fail({errMsg:'Isolated HTTP transport failed'})}
})}}
async function run(){
 const {request,newSessionKey}=require('../utils/request'),api=require('../utils/boss/api')
 const token=await request('/system/auth/login',{method:'POST',header:{'tenant-id':String(credentials.tenantId)},data:{username:credentials.username,password:credentials.password}})
 const session={...token,tenantId:credentials.tenantId,sessionKey:newSessionKey()};storage.set('yc_session',session);checks.push('native-request-login')
 const info=await api.identity(session);assert.ok(info.roles.includes('super_admin'));checks.push('boss-identity')
 const users=await api.list(session,'users',{},1);assert.ok(users.total>=1);assert.ok(users.rows.some(x=>String(x.id)==='1'));checks.push('boss-users-list')
 const detail=await api.detail(session,'users','1');assert.equal(String(detail.id),'1');assert.equal(detail.canEdit,false);checks.push('self-edit-protection')
 const form=await api.form(session,'users');assert.ok(Array.isArray(form.departments)&&Array.isArray(form.posts));checks.push('user-form-options')
 const profile=await api.profile(session);assert.equal(profile.username,credentials.username);checks.push('profile')
 const caps=await api.capabilities(session);assert.equal(caps.correctionsEnabled,true);checks.push('capabilities')
 const entries=require('../utils/admin-entries').visible(info);assert.ok(entries.length>10);checks.push('admin-entry-permissions')
 await request('/system/auth/logout',{method:'POST',data:{},header:{Authorization:'Bearer '+session.accessToken,'tenant-id':String(session.tenantId)}});storage.clear();checks.push('native-request-logout')
 console.log(JSON.stringify({passed:true,checks},null,2))
}
run().catch(e=>{storage.clear();console.error(JSON.stringify({passed:false,checks,error:e.message}));process.exitCode=1})
