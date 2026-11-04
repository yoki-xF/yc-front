const assert=require('node:assert/strict'),Module=require('node:module')
let current={tenantId:'1',accessToken:'fresh'},permissions=['*:*:*'],calls=[],mode='ok',pending
const active=s=>{if(s!==current)throw Error('账号变化');return current}
const fakeRequest=async(path,o)=>{calls.push({path,...o});if(mode==='pending')return new Promise(r=>{pending=r});if(mode==='network')throw Error('断网');if(mode==='denied'){const e=Error('拒绝');e.code=403;throw e}if(path.endsWith('/save'))return '9007199254740993123';if(path.endsWith('/remove'))return true;if(path.endsWith('/get'))return {id:o.data.id,revision:'version'};if(path.endsWith('/options'))return {departments:[{id:'9007199254740993123',name:'A'}]};return {list:[],total:0}}
const original=Module._load;Module._load=function(name,...args){if(name==='../request')return {request:fakeRequest};if(name==='../boss/api')return {active,identity:async s=>{active(s);return {permissions}}};return original.call(this,name,...args)}
const api=require('../utils/admin-business/api');Module._load=original
async function run(){
 const session=current,options=await api.options(session),deps=options.departments;assert.equal(deps[0].id,'9007199254740993123')
 await api.list(session,'shifts',{keyword:'早'},2);assert.equal(calls.at(-1).data.pageNo,2)
 const {row}=await api.detail(session,'games','9007199254740993123');assert.equal(row.id,'9007199254740993123')
 await api.save(session,'games',{gameName:'A',gameCode:'a',rebate:'0.05',stat:'0'},deps,row);assert.equal(calls.at(-1).data.revision,'version');assert.equal(calls.at(-1).data.values.rebate,'0.05')
 permissions=['sport:game-sales-config:update'];await api.remove(session,'games',row);assert.equal(calls.at(-1).path,'/sport/boss/admin/games/remove')
 permissions=[];let n=calls.length;await assert.rejects(api.remove(session,'games',row),/权限/);assert.equal(calls.length,n)
 permissions=['*:*:*'];mode='network';await assert.rejects(api.remove(session,'games',row),e=>e.mayHaveWritten===true)
 mode='denied';await assert.rejects(api.remove(session,'games',row),e=>e.mayHaveWritten===false)
 mode='pending';const list=api.list(session,'games',{});await new Promise(r=>setImmediate(r));current={tenantId:'2',accessToken:'other'};pending({list:[{id:'1'}],total:1});await assert.rejects(list,/账号/)
 console.log('business API: permission checks, immutable versions, decimal strings, unknown writes and stale account protection pass')
}
run().catch(e=>{console.error(e);process.exitCode=1})
