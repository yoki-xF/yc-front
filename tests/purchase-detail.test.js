const assert=require('node:assert/strict'),Module=require('node:module')
let definition,calls=0,status=0
const session={tenantId:1,accessToken:'a',refreshToken:'r'},storage={yc_session:session}
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>storage[k]=v,removeStorageSync:k=>delete storage[k],showModal:o=>o.success({confirm:true})};global.Page=p=>definition=p
const original=Module._load;Module._load=function(name,...args){if(name==='../../utils/operating-day')return require('./operating-day-fixture');if(name==='../../utils/request')return{sameSession:(a,b)=>!!(a&&b&&a.tenantId===b.tenantId&&a.refreshToken===b.refreshToken),request:async(path,opts)=>{if(opts.method==='POST'){calls++;throw Error('timeout')}return {revision:'revision-1',order:{stat:status,orderNo:'P1',totalAmount:5},items:[]}}};return original.call(this,name,...args)}
require('../pages/order-detail/index');Module._load=original
const page=Object.assign({},definition,{data:structuredClone(definition.data),setData(o){Object.assign(this.data,o)}})
async function run(){page.onLoad({deptId:'1',userId:'1',type:'purchase',id:'1'});await new Promise(r=>setImmediate(r));await page.transition({currentTarget:{dataset:{action:'confirm'}}});assert.equal(page.data.uncertain,true);assert.equal(storage[page.lockKey],true);await page.transition({currentTarget:{dataset:{action:'confirm'}}});assert.equal(calls,1);status=1;await page.load();assert.equal(page.data.uncertain,false);assert.equal(page.data.order.status,'已确认');assert.equal(storage[page.lockKey],undefined);console.log('订票操作未知状态、重复阻止与状态重读检查通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
