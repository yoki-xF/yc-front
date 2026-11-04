const assert = require('node:assert/strict'), Module = require('node:module')
const countFields=['hskCount','zfbCount','szRmbCount','wxBalanceCount']
let definition, calls=0, fail=false, sent, revision='v1', empty=false
const session={tenantId:1,accessToken:'a',refreshToken:'r'}, storage={yc_session:session}
global.wx={ getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=structuredClone(v)},removeStorageSync:k=>{delete storage[k]},showToast(){},showModal:o=>o.success({confirm:true}) }
global.Page=value=>{definition=value}
const original=Module._load
Module._load=function(name,...args) {if(name==='../../utils/operating-day')return require('./operating-day-fixture'); if(name==='../../utils/request')return {sameSession:(a,b)=>!!(a&&b&&a.refreshToken===b.refreshToken&&a.tenantId===b.tenantId),request:async(path,opts)=>{
 if(path.endsWith('/fund/safe-item'))return {revision,record:empty?null:{id:5,xj:10,wxBalance:0,hsk:5,hskCount:2,zfbCount:3,szRmbCount:4,wxBalanceCount:0,zfb:8,szRmb:3}}
 if(path.endsWith('/fund/safe-submit')){calls++;sent=opts.data.record;if(fail)throw Error('超时');return true}
}};return original.call(this,name,...args) }
require('../pages/fund/index');Module._load=original
const page=Object.assign({},definition,{data:structuredClone(definition.data),setData(obj){Object.assign(this.data,obj)}})
async function run(){
 page.onLoad({deptId:'1',userId:'1',deptName:'测试'});await new Promise(r=>setImmediate(r));assert.equal(page.data.zfb,'8')
 assert.deepEqual(countFields.map(k=>page.data[k]),['2','3','4','0'])
 for(const key of countFields) {
  const previous=page.data[key]
  for(const value of ['-1','1.5','100000000','abc',' ']) {
   page.input({currentTarget:{dataset:{field:key}},detail:{value}});await page.submit();assert.equal(calls,0, key+': '+value)
  }
  page.input({currentTarget:{dataset:{field:key}},detail:{value:previous}})
 }
 // Legacy drafts retain precise amounts; newly introduced fields stay empty.
 storage[page.draftKey]={revision,xj:'9999999999.99',wxBalance:'0.00',hsk:'1.20',zfb:'2.30',szRmb:'3.40',hskCount:'7'}
 await page.load();assert.equal(page.data.xj,'9999999999.99');assert.deepEqual(countFields.map(k=>page.data[k]),['7','','',''])
 await page.submit();assert.equal(calls,1);assert.equal(sent.hskCount,7);for(const key of countFields.slice(1))assert.equal(Object.hasOwn(sent,key),false)
 calls=0
 for(const [i,key] of countFields.entries())page.input({currentTarget:{dataset:{field:key}},detail:{value:String(i===0?99999999:i-1)}})
 await page.load();assert.deepEqual(countFields.map(k=>page.data[k]),['99999999','0','1','2'])
 assert.deepEqual(countFields.map(k=>storage[page.draftKey][k]),['99999999','0','1','2'])
 page.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'12.345'}});await page.submit();assert.equal(calls,0);assert.equal(page.data.ready,true)
 page.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'-12.30'}});assert.equal(storage[page.draftKey].xj,'-12.30')
 fail=true;await page.submit();assert.equal(page.data.uncertain,true);await page.submit();assert.equal(calls,1)
 page.confirmChecked();fail=false;await page.submit();assert.equal(calls,2);assert.equal(sent.xj,'-12.30');assert.deepEqual(countFields.map(k=>sent[k]),[99999999,0,1,2]);assert.deepEqual([sent.xj,sent.wxBalance,sent.hsk,sent.zfb,sent.szRmb],['-12.30','0','5','8','3']);assert.equal(storage[page.draftKey],undefined)
 page.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'17'}});revision='v2';await page.load();assert.equal(page.data.conflict,true);assert.equal(page.data.xj,'17');await page.submit();assert.equal(calls,2);page.reloadLatest();await new Promise(r=>setImmediate(r));assert.equal(page.data.conflict,false)
 page.input({currentTarget:{dataset:{field:'zfbCount'}},detail:{value:'56'}})
 const oldKey=page.draftKey, savedDraft=structuredClone(storage[oldKey])
 const fresh=()=>Object.assign({},definition,{data:structuredClone(definition.data),setData(obj){Object.assign(this.data,obj)}})
 for(const options of [{deptId:'2',userId:'1'},{deptId:'1',userId:'2'}]) {
  const other=fresh();other.onLoad(options);await new Promise(r=>setImmediate(r));assert.notEqual(other.draftKey,oldKey);assert.deepEqual(countFields.map(k=>other.data[k]),['2','3','4','0'])
 }
 assert.deepEqual(storage[oldKey],savedDraft)
 empty=true;const initial=fresh();initial.onLoad({deptId:'3',userId:'1'});await new Promise(r=>setImmediate(r));assert.equal(initial.data.existing,false);assert.deepEqual(countFields.map(k=>initial.data[k]),['','','',''])
 storage.yc_session={...session,refreshToken:'changed'};await page.submit();assert.equal(calls,2);assert.match(page.data.error,/账号已切换/);storage.yc_session=session
 console.log('资金精度、草稿和提交未知状态检查通过')
}
run().catch(err=>{console.error(err);process.exitCode=1})
