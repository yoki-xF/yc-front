const assert = require('node:assert/strict'), Module = require('node:module')
let definition, calls=0, fail=false, sent, revision='v1'
const session={tenantId:1,accessToken:'a',refreshToken:'r'}, storage={yc_session:session}
global.wx={ getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=structuredClone(v)},removeStorageSync:k=>{delete storage[k]},showToast(){},showModal:o=>o.success({confirm:true}) }
global.Page=value=>{definition=value}
const original=Module._load
Module._load=function(name,...args) {if(name==='../../utils/operating-day')return require('./operating-day-fixture'); if(name==='../../utils/request')return {sameSession:(a,b)=>!!(a&&b&&a.refreshToken===b.refreshToken&&a.tenantId===b.tenantId),request:async(path,opts)=>{
 if(path.endsWith('/fund/safe-item'))return {revision,record:{id:5,xj:10,wxBalance:0,hsk:5,hskCount:2,zfb:8,szRmb:3}}
 if(path.endsWith('/fund/safe-submit')){calls++;sent=opts.data.record;if(fail)throw Error('超时');return true}
}};return original.call(this,name,...args) }
require('../pages/fund/index');Module._load=original
const page=Object.assign({},definition,{data:structuredClone(definition.data),setData(obj){Object.assign(this.data,obj)}})
async function run(){
 page.onLoad({deptId:'1',userId:'1',deptName:'测试'});await new Promise(r=>setImmediate(r));assert.equal(page.data.zfb,'8')
 page.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'12.345'}});await page.submit();assert.equal(calls,0);assert.equal(page.data.ready,true)
 page.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'-12.30'}});assert.equal(storage[page.draftKey].xj,'-12.30')
 fail=true;await page.submit();assert.equal(page.data.uncertain,true);await page.submit();assert.equal(calls,1)
 page.confirmChecked();fail=false;await page.submit();assert.equal(calls,2);assert.equal(sent.xj,'-12.30');assert.deepEqual([sent.xj,sent.wxBalance,sent.hsk,sent.zfb,sent.szRmb],['-12.30','0','5','8','3']);assert.equal(storage[page.draftKey],undefined)
 page.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'17'}});revision='v2';await page.load();assert.equal(page.data.conflict,true);assert.equal(page.data.xj,'17');await page.submit();assert.equal(calls,2);page.reloadLatest();await new Promise(r=>setImmediate(r));assert.equal(page.data.conflict,false)
 console.log('资金精度、草稿和提交未知状态检查通过')
}
run().catch(err=>{console.error(err);process.exitCode=1})
