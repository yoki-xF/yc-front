const assert=require('node:assert/strict'), Module=require('node:module')
let definition, calls=0, fail=false, submitted, records=[]
const session={tenantId:1,accessToken:'a',refreshToken:'r'}, storage={yc_session:session}
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=structuredClone(v)},removeStorageSync:k=>delete storage[k],showToast(){},showModal:o=>o.success({confirm:true})};global.Page=p=>definition=p
const original=Module._load
Module._load=function(name,...args){if(name==='../../utils/operating-day')return require('./operating-day-fixture');if(name==='../../utils/request') return {sameSession:(a,b)=>!!(a&&b&&a.tenantId===b.tenantId&&a.refreshToken===b.refreshToken),request:async(path,opts)=>{if(opts.method==='POST'){calls++;submitted=opts.data;if(fail)throw Error('timeout');records=[{id:1,price:opts.data.transfer.shiftAmount,source:0,remark:opts.data.transfer.remark}];return true} return records}};return original.call(this,name,...args)}
require('../pages/cash-transfer/index');Module._load=original
const page=Object.assign({},definition,{data:structuredClone(definition.data),setData(o){Object.assign(this.data,o)}})
const input=(key,value)=>page.input({currentTarget:{dataset:{key}},detail:{value}})
async function run(){page.onLoad({deptId:'1',userId:'1',deptName:'测试'});await new Promise(r=>setImmediate(r));input('amount','1.234');await page.submit();assert.equal(calls,0);input('amount','12.35');input('remark','测试');fail=true;await page.submit();assert.equal(page.data.uncertain,true);await page.submit();assert.equal(calls,1);assert.equal(storage[page.draftKey].amount,'12.35');const requestKey=storage[page.draftKey].requestKey;input('amount','50');assert.equal(page.data.amount,'12.35');fail=false;await page.submit(true);assert.equal(calls,2);assert.equal(submitted.requestKey,requestKey);assert.equal(submitted.transfer.remark,'测试');assert.equal(page.data.records[0].amount,'12.35');assert.equal(storage[page.draftKey],undefined);console.log('备付金金额校验、流水重读、草稿和提交未知状态检查通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
