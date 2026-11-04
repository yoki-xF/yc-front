const assert=require('node:assert/strict')
let current={tenantId:'1',accessToken:'old',refreshToken:'refresh-old',sessionKey:'login_A_1234567890'},refreshes=0,writes=0,pending,mode='normal'
global.wx={getStorageSync:()=>({...current}),setStorageSync:(key,v)=>{current={...v}},request(o){
 if(o.url.endsWith('/system/auth/refresh-token')){refreshes++;return setImmediate(()=>o.success({statusCode:200,data:{code:0,data:{accessToken:'new',refreshToken:'refresh-rotated'}}}))}
 if(mode==='hold'){pending=o;return}
 if(o.method==='POST'){writes++;return setImmediate(()=>o.success({statusCode:200,data:{code:0,data:o.header.Authorization}}))}
 setImmediate(()=>o.success({statusCode:200,data:o.header.Authorization==='Bearer new'?{code:0,data:'ok'}:{code:401}}))
}}
const {request,sameSession,newSessionKey}=require('../utils/request')
async function run(){const captured={...current},header={Authorization:'Bearer old','tenant-id':'1'};assert.equal(await request('/read',{header}),'ok');assert.equal(refreshes,1);assert.equal(current.refreshToken,'refresh-rotated');assert.ok(sameSession(captured,current));assert.equal(await request('/write',{method:'POST',header}),'Bearer new');assert.equal(writes,1);assert.equal(refreshes,1)
 assert.ok(!sameSession(captured,{...current,sessionKey:'login_B_1234567890'}));assert.ok(!sameSession(captured,{...current,tenantId:'2'}));assert.ok(!sameSession(captured,{...current,sessionKey:undefined}));assert.notEqual(newSessionKey(),newSessionKey())
 mode='hold';const late=request('/late',{header:{Authorization:'Bearer new','tenant-id':'1'}});current={tenantId:'1',accessToken:'other',refreshToken:'other',sessionKey:'login_B_1234567890'};pending.success({statusCode:200,data:{code:0,data:{private:'old account data'}}});await assert.rejects(late,/账号已切换/)
 mode='normal';await assert.rejects(request('/new-login',{method:'POST',header}),/账号已切换/);assert.equal(writes,1);assert.equal(refreshes,1)
 console.log('Session rotation: login epoch survives token rotation, original-form header rebase, no write replay, account change and late data rejection pass')
}
run().catch(e=>{console.error(e);process.exitCode=1})
