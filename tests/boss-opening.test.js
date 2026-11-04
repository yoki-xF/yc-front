const assert=require('node:assert/strict'),Module=require('node:module'),load=Module._load
let session={tenantId:1,accessToken:'synthetic-opening'},storage=new Map(),writes=[],responder
global.wx={getStorageSync:k=>k==='yc_session'?session:storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),showModal:o=>o.success({confirm:true})}
Module._load=function(name,parent,main){if(name==='../request')return {sameSession:(a,b)=>!!a&&!!b&&a.tenantId===b.tenantId&&a.accessToken===b.accessToken,request:async(path,options)=>{if(path.endsWith('permission-info'))return {user:{id:11},permissions:['sport:store-opening:create']};if(path.endsWith('/apply'))writes.push(options.data);return responder(path,options)}};return load.call(this,name,parent,main)}
const opening=require('../utils/boss/opening');Module._load=load
const materials=[{id:'9007199254740993',materialName:'Ticket',price:'600',money:'20',revision:'a'.repeat(64),selected:true,packageNum:'1',sheetNum:'2'}]
const funds={xj:'100',wxBalance:'200',hsk:'300',zfb:'400',szRmb:'500'}
const body=opening.payload('10',funds,materials,'Initial acceptance baseline','opening-request-123456789')
assert.equal(body.lines[0].materialId,'9007199254740993');assert.equal(body.funds.szRmb,'500')
assert.throws(()=>opening.payload('10',{...funds,zfb:'1.001'},materials,body.reason,body.requestKey),/两位/)
assert.throws(()=>opening.payload('10',funds,[{...materials[0],packageNum:'1000001'}],body.reason,body.requestKey),/1000000/)
assert.throws(()=>opening.payload('10',funds,[],body.reason,body.requestKey),/至少/)
let definition;global.Page=p=>{definition=p};require('../pages/boss/opening/index')
function page(){return {...definition,data:structuredClone(definition.data),session,version:0,actor:'11',pendingKey:'yc_boss_opening_1_11',setData(p){for(const [key,value] of Object.entries(p)){const parts=key.split('.');if(parts.length===1)this.data[key]=value;else{let o=this.data;while(parts.length>1)o=o[parts.shift()];o[parts[0]]=value}}}}}
function ready(){const p=page();p.data.departments=[{id:'10',name:'Store'}];p.data.deptIndex=0;p.data.materials=structuredClone(materials);p.data.funds={...funds};p.data.reason=body.reason;p.data.status={initialized:false,canInitialize:true};p.data.loading=false;return p}
async function run(){
  responder=async path=>path.endsWith('/options')?{departments:[{id:'10',name:'Store'}],materials}: {initialized:false,canInitialize:true,reason:''}
  storage.set('yc_boss_opening_1_11',body)
  const pending=page();await pending.load();assert.equal(pending.data.loading,false);assert.equal(pending.data.busy,false);assert.equal(pending.data.pending,true);assert.equal(pending.data.status.canInitialize,true)
  let resolve;global.wx.showModal=o=>{resolve=o.success};writes=[];const leaving=ready(),promise=leaving.submit();leaving.onUnload();resolve({confirm:true});await promise;assert.equal(writes.length,0)
  global.wx.showModal=o=>o.success({confirm:true});storage.clear();const failure=ready();global.wx.setStorageSync=()=>{throw Error('storage full')};await failure.submit();assert.equal(failure.data.busy,false);assert.match(failure.data.error,/存储/);assert.equal(writes.length,0)
  global.wx.setStorageSync=(k,v)=>storage.set(k,v);responder=async()=>{throw Error('timeout')};const retry=ready();await retry.submit();assert.equal(retry.data.pending,true);assert.equal(writes.length,1);const requestKey=writes[0].requestKey
  responder=async()=>({status:'INITIALIZED',deptId:'10'});await retry.retryPending();assert.equal(writes.length,2);assert.equal(writes[1].requestKey,requestKey);assert.equal(retry.data.pending,false);assert.equal(retry.data.status.initialized,true);assert.equal(storage.has(retry.pendingKey),false)
  const old=session;responder=async()=>{session={tenantId:2,accessToken:'other'};return {initialized:false,canInitialize:true}}
  await assert.rejects(opening.status(old,'10'),/账号已变化/)
  console.log('首次初始化五账户、长整数、草稿状态恢复、离页不写、存储失败不提交及同请求重试检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
