const assert=require('node:assert/strict'),Module=require('node:module')
let definition,current={tenantId:1,accessToken:'synthetic-delete'},approve=true,mode='pending',writes=[],resolveWrite,modal
const api={active(s){if(s!==current)throw Error('账号已变化')},detail:async()=>({canDelete:true,revision:'a'.repeat(64)}),removeCatalog:async(...args)=>{writes.push(args);if(mode==='pending')return new Promise(resolve=>{resolveWrite=resolve});if(mode==='denied'){const e=Error('权限已变化');e.code=403;throw e}if(mode==='timeout'){const e=Error('timeout');e.mayHaveWritten=true;throw e}return true}}
global.Page=p=>{definition=p};global.wx={getStorageSync:()=>current,showModal:o=>{if(modal)modal=o.success;else o.success({confirm:approve})},navigateBack(){}}
const original=Module._load;Module._load=function(name,...args){if(name==='../../../utils/boss/api')return api;return original.call(this,name,...args)};require('../pages/boss/detail/index');Module._load=original
const tick=()=>new Promise(r=>setImmediate(r))
async function ready(type='costs'){const p={...definition,data:structuredClone(definition.data),setData(v){Object.assign(this.data,v)}};p.onLoad({type,id:'1'});await tick();return p}
async function run(){
 const p=await ready();approve=false;await p.removeCatalog();assert.equal(writes.length,0);assert.equal(p.data.deleteBusy,false)
 approve=true;const pending=p.removeCatalog();await tick();await p.removeCatalog();assert.equal(writes.length,1);resolveWrite(true);await pending;assert.equal(p.data.deleteDone,true);assert.equal(p.data.deleteBusy,false)
 mode='denied';const denied=await ready('materials');await denied.removeCatalog();assert.equal(denied.data.deleteBusy,false);assert.equal(denied.data.deleteUncertain,false);assert.match(denied.data.error,/权限/)
 mode='success';await denied.removeCatalog();assert.equal(denied.data.deleteDone,true);assert.equal(writes[2][1],'materials')
 mode='timeout';const uncertain=await ready();await uncertain.removeCatalog();const count=writes.length;await uncertain.removeCatalog();assert.equal(writes.length,count);assert.equal(uncertain.data.deleteUncertain,true)
 modal=true;const leaving=await ready(),confirm=leaving.removeCatalog();leaving.onUnload();modal({confirm:true});await confirm;assert.equal(writes.length,count)
 modal=null;const swapped=await ready();current={tenantId:2,accessToken:'different'};await swapped.removeCatalog();assert.equal(writes.length,count)
 console.log('目录软删除取消、并发点击、失败恢复、结果未确认停写、离页和账号切换保护检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
