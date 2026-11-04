const assert=require('node:assert/strict'),Module=require('node:module'),original=Module._load
let session={tenantId:1,accessToken:'synthetic-day'},response,writes=[],storage=new Map()
global.wx={getStorageSync:k=>k==='yc_session'?session:storage.get(k),setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),showModal:o=>o.success({confirm:true})}
Module._load=function(name,parent,main){if(name==='../request')return {sameSession:(a,b)=>!!a&&!!b&&a.tenantId===b.tenantId&&a.accessToken===b.accessToken,request:async(path,options)=>{if(options.method==='POST')writes.push(structuredClone(options.data));return response(path,options)}};return original.call(this,name,parent,main)}
const day=require('../utils/boss/operating-day');Module._load=original
const status={id:'12345678-1234-1234-1234-123456789abc',deptId:'10',status:'OPEN',businessDate:'2026-11-02',revision:'1'}
const preview={...status,status:'READY_TO_CLOSE',sourceRevision:'a'.repeat(64),funds:['xj','wxBalance','hsk','zfb','szRmb'].map(key=>({key,opening:'100.00',closing:'100.00'})),report:{ruleVersion:'store-five-funds-three-sales-v1',...Object.fromEntries(['openingFunds','closingFunds','reserveIn','instantSales','electronicSales','sportsBettingSales','totalSales','adjustments','wrongTicket','variance'].map(k=>[k,'0.00']))}}
let definition;global.Page=p=>{definition=p};require('../pages/boss/operating-day/index')
function page(){return {...definition,data:{...structuredClone(definition.data),loading:false,departments:[{id:'10',name:'Store'}],deptIndex:0,status:structuredClone(status),preview:structuredClone(preview),canOpen:true,canClose:true},session,version:0,pendingKey:'yc_business_day_1_11',setData(p){Object.assign(this.data,p)}}}
async function run(){
  assert.throws(()=>day.command('open',9007199254740992,'day-request-12345678'),/编号/)
  assert.equal(day.command('open','9007199254740993','day-request-12345678').data.deptId,'9007199254740993')
  assert.throws(()=>day.command('close','20','day-request-12345678',preview),/状态/)
  response=async()=>structuredClone(preview);assert.equal((await day.preview(session,'10')).funds[4].label,'数字人民币')
  response=async()=>({...preview,funds:[preview.funds[0],...preview.funds.slice(0,4)]});await assert.rejects(day.preview(session,'10'),/重复/)
  response=async()=>({...preview,report:{...preview.report,variance:null}});await assert.rejects(day.preview(session,'10'),/金额/)
  const p=page();response=async()=>{throw Error('timeout')};await p.close();assert.equal(writes.length,1);assert.equal(p.data.pending,true);assert.equal(p.data.busy,false)
  const key=writes[0].requestKey;response=async()=>({...status,status:'CLOSED'});await p.retry();assert.equal(writes.length,2);assert.equal(writes[1].requestKey,key);assert.equal(p.data.pending,false);assert.equal(p.data.status.status,'CLOSED');assert.equal(storage.size,0)
  const stale=page();response=async()=>{const e=Error('source changed');e.code=10086;throw e};await stale.close();assert.equal(stale.data.preview,null);assert.equal(stale.data.pending,false)
  let approve;wx.showModal=o=>{approve=o.success};const gone=page(),promise=gone.close();gone.onUnload();approve({confirm:true});await promise;assert.equal(writes.length,3)
  wx.showModal=o=>o.success({confirm:true});const full=page();wx.setStorageSync=()=>{throw Error('storage full')};await full.close();assert.equal(writes.length,3);assert.match(full.data.error,/尚未提交/)
  const old=session;response=async()=>{session={tenantId:2,accessToken:'different'};return status};await assert.rejects(day.current(old,'10'),/账号已变化/)
  console.log('营业日预览、长整数、五账户校验、断网同请求重试、过期预览清除、离页与存储失败不提交检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
