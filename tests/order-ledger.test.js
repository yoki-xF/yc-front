const assert=require('node:assert/strict'), Module=require('node:module')
let definition, calls=[], delayed
const session={tenantId:1,accessToken:'a',refreshToken:'r'}
global.wx={getStorageSync:()=>session,navigateTo(){}};global.Page=p=>definition=p
const original=Module._load
Module._load=function(name,...args){if(name==='../../utils/request')return {sameSession:(a,b)=>a===b,request:async(path,opt)=>{calls.push(opt.data);if(opt.data.type==='purchase')return new Promise(resolve=>{delayed=resolve});if(opt.data.direction==='out')return {list:[{id:4,orderNo:'OUT',stat:0,totalAmount:15,deptName:'目标门店'}],total:1};return {list:[{id:3,orderNo:'T',stat:1,totalAmount:20}],total:1}}};return original.call(this,name,...args)}
require('../pages/order-ledger/index');Module._load=original
const page=Object.assign({},definition,{data:structuredClone(definition.data),setData(o){Object.assign(this.data,o)}})
const tick=()=>new Promise(r=>setImmediate(r))
async function run(){page.onLoad({deptId:'1',userId:'1',deptName:'测试'});await tick();page.switchType({currentTarget:{dataset:{type:'transfer'}}});await tick();assert.equal(page.data.items[0].orderNo,'T');delayed({list:[{id:2,orderNo:'P',stat:0}],total:1});await tick();assert.equal(page.data.items[0].orderNo,'T');assert.equal(calls[0].deptId,'1');assert.equal(page.data.loading,false);assert.equal(page.data.items[0].status,'已确认');page.switchDirection({currentTarget:{dataset:{direction:'out'}}});await tick();assert.equal(page.data.items[0].orderNo,'OUT');assert.equal(calls[calls.length-1].direction,'out');console.log('单据类型切换、迟到响应及门店参数检查通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
