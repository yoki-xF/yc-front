const assert=require('node:assert/strict'),Module=require('node:module'),original=Module._load
let session={tenantId:1,accessToken:'synthetic',sessionKey:'commission-session'},storage=new Map(),responder=async()=>{},writes=[]
global.wx={getStorageSync:k=>k==='yc_session'?session:storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k)}
Module._load=function(name,parent,main){if(name==='../request')return {sameSession:(a,b)=>a?.sessionKey===b?.sessionKey,request:async(path,options)=>{if(path.endsWith('permission-info'))return {user:{id:'11'},permissions:['sport:check-game-sales:create']};if(path.endsWith('/create'))writes.push(options.data);return responder(path,options)}};return original.call(this,name,parent,main)}
const service=require('../utils/boss/commission-create');Module._load=original
const context={day:{id:'11111111-1111-1111-1111-111111111111',deptId:'10',businessDate:'2026-11-02',status:'OPEN'},revision:'a'.repeat(64),users:[{id:'9007199254740993',name:'User'}],games:[{id:'4',name:'Game',rebate:'0.1234'}]}
const values={userId:'9007199254740993',gameSalesId:'4',salesAmount:'9007199254.99',rebate:'0.1234',commission:'123.45',reason:'首次创建返佣盘点'}
const body=service.command('10',context,values,'commission-create-12345678')
assert.equal(body.userId,values.userId);assert.equal(body.salesAmount,'9007199254.99');assert.equal(body.dayId,context.day.id)
assert.throws(()=>service.command('10',context,{...values,userId:9007199254740992},body.requestKey),/编号/)
for(const invalid of ['-1','1.001','1e2','10000000000'])assert.throws(()=>service.command('10',context,{...values,salesAmount:invalid},body.requestKey),/销售额/)
assert.throws(()=>service.command('10',context,{...values,rebate:'100.0001'},body.requestKey),/返点/)
assert.throws(()=>service.command('10',context,{...values,userId:'12'},body.requestKey),/请选择/)
let definition;global.Page=p=>{definition=p};require('../pages/boss/commission-create/index')
function page(){return {...definition,data:structuredClone(definition.data),session,version:0,storageKey:'test-pending',setData(p){for(const [key,value] of Object.entries(p)){const parts=key.split('.');if(parts.length===1)this.data[key]=value;else this.data[parts[0]][parts[1]]=value}}}}
function ready(){const p=page();p.context=context;p.data.loading=false;p.data.departments=[{id:'10',name:'Store'}];p.data.deptIndex=0;p.data.users=context.users;p.data.games=context.games;p.data.userIndex=0;p.data.gameIndex=0;p.data.values={...values};return p}
async function run(){
 responder=async()=>context;assert.equal((await service.options(session,'10')).revision,context.revision)
 responder=async()=>{throw Error('timeout')};const p=ready();await p.submit();assert.equal(p.data.pending,true);assert.equal(writes.length,1);await p.submit();assert.equal(writes.length,1)
 const first=writes[0];responder=async()=>({status:'CREATED',recordId:'99',auditId:'audit'});await p.retry();assert.equal(writes.length,2);assert.deepEqual(writes[1],first);assert.equal(p.data.pending,false);assert.equal(storage.has('test-pending'),false)
 const fail=ready();global.wx.setStorageSync=()=>{throw Error('storage full')};await fail.submit();assert.equal(writes.length,2);assert.equal(fail.data.busy,false);global.wx.setStorageSync=(k,v)=>storage.set(k,v)
 storage.set('yc-commission-pending:1:11',body);const restored=page();await restored.load();assert.equal(restored.data.pending,true);assert.deepEqual(restored.pendingBody,body)
 const old=session;responder=async()=>{session={tenantId:2,accessToken:'other',sessionKey:'other'};return context};await assert.rejects(service.options(old,'10'),/账号已变化/)
 console.log('返佣新增精确金额、长编号、营业日、草稿恢复、重复阻断、同请求重试、存储失败及换账号检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
