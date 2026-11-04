const assert=require('node:assert/strict'),Module=require('node:module')
let page,current={tenantId:'1',accessToken:'synthetic'},approve=true,writes=0,mode='ok',resolveWrite,modal
const auth={active(s){if(s!==current)throw Error('账号变化');return current}}
const api={unlink(){},can:()=>true,list:async()=>({list:[],total:0,permissions:['*:*:*']}),options:async()=>({departments:[{id:'1',name:'A'}],shiftTypes:[]}),detail:async()=>({row:{id:'3',revision:'v',gameName:'A',gameCode:'a',rebate:'0.05',stat:'0'},permissions:['*:*:*']}),permission:async()=>['*:*:*'],save:async()=>{writes++;if(mode==='pending')return new Promise(r=>{resolveWrite=r});if(mode==='unknown'){const e=Error('timeout');e.mayHaveWritten=true;throw e}return '3'},remove:async()=>{writes++;return true}}
global.Page=p=>{page=p};global.wx={getStorageSync:()=>current,setNavigationBarTitle(){},showModal(o){if(modal)modal=o;else o.success({confirm:approve})}}
const original=Module._load;Module._load=function(name,...args){if(name==='../../../utils/admin-business/api')return api;if(name==='../../../utils/boss/api')return auth;return original.call(this,name,...args)};require('../pages/admin-business/manage/index');Module._load=original
const tick=()=>new Promise(r=>setImmediate(r))
async function ready(){const p={...page,data:structuredClone(page.data),setData(v){for(const [key,value] of Object.entries(v)){const parts=key.replace(/\[(\d+)\]/g,'.$1').split('.');let x=this.data;for(const part of parts.slice(0,-1))x=x[part];x[parts.at(-1)]=value}}};p.onLoad({type:'games'});await tick();await p.edit({currentTarget:{dataset:{id:'3'}}});return p}
async function run(){
 const p=await ready();approve=false;await p.submit();assert.equal(writes,0);assert.equal(p.data.busy,false)
 approve=true;mode='pending';const pending=p.submit();await tick();await p.submit();await p.remove();assert.equal(writes,1);resolveWrite('3');await pending;assert.equal(p.data.saved,true)
 mode='unknown';const unknown=await ready();await unknown.submit();const n=writes;await unknown.submit();await unknown.remove();assert.equal(writes,n);assert.equal(unknown.data.uncertain,true)
 mode='ok';modal=true;const leaving=await ready();const confirming=leaving.submit();leaving.onUnload();modal.success({confirm:true});await confirming;assert.equal(writes,n)
 modal=null;const switched=await ready();current={tenantId:'2',accessToken:'other'};await switched.submit();assert.equal(writes,n)
 console.log('business page: modal cancel, double submission, unknown-result lock, unload and changed account pass')
}
run().catch(e=>{console.error(e);process.exitCode=1})
