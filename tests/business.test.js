const assert=require('node:assert/strict'), Module=require('node:module')
let pageDef, submitted, fail=false, calls=0, uploadCalls=0, revision="v1", accept=true
const session={tenantId:1,accessToken:'a',refreshToken:'r'}, storage={yc_session:session}
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=structuredClone(v)},removeStorageSync:k=>delete storage[k],showToast(){},showModal:o=>o.success({confirm:accept}),uploadFile:o=>{uploadCalls++;o.fail({})}}
global.Page=p=>pageDef=p
const original=Module._load
Module._load=function(name,...args){if(name==='../../utils/operating-day')return require('./operating-day-fixture'); if(name==='../../utils/request') return {sameSession:(a,b)=>!!(a&&b&&a.tenantId===b.tenantId&&a.refreshToken===b.refreshToken),request:async(path,opts)=>{
 if(path.endsWith('/service/safe-item')) return {revision,record:{id:7,dcSaleMoney:20,classes:'Late',voucherPic:'https://test/a'}}
 if(path.endsWith('/dict-data/type')) return [{dictLabel:'晚班',dictValue:'Late'}]
 if(path.endsWith('/service/safe-submit')) {calls++;submitted=opts.data;if(fail) throw Error('timeout');return true}
 }};return original.call(this,name,...args) }
require('../pages/business/index');Module._load=original
const page=Object.assign({},pageDef,{data:structuredClone(pageDef.data),setData(update){for(const [key,value] of Object.entries(update)){if(key.startsWith('values.')) this.data.values[key.slice(7)]=value;else this.data[key]=value}}})
const input=(key,value)=>page.input({currentTarget:{dataset:{key}},detail:{value}})
async function run(){
 page.onLoad({deptId:'1',userId:'1',deptName:'测试'});await new Promise(r=>setImmediate(r));assert.equal(page.data.values.dcSaleMoney,'20');assert.equal(page.data.images[0].url,'https://test/a')
 input('dcSaleMoney','1.234');await page.submit();assert.equal(calls,0)
 input('dcSaleMoney','12.30');page.setData({suggestions:[{key:'dcSaleMoney',value:'50',initial:'20'},{key:'jcSaleNum',value:'3',initial:''}]});page.applyScan();assert.equal(page.data.values.dcSaleMoney,'12.30');assert.equal(page.data.values.jcSaleNum,'3')
 page.setData({images:[{local:'test-image'}]});await page.submit();assert.equal(uploadCalls,1);assert.equal(calls,0);assert.ok(storage[page.draftKey])
 page.setData({images:[{url:'https://test/a'}]});fail=true;await page.submit();assert.equal(page.data.uncertain,true);await page.submit();assert.equal(calls,1)
 page.confirmChecked();fail=false;await page.submit();assert.equal(calls,2);assert.equal(submitted.record.dcSaleMoney,'12.30');assert.equal(submitted.record.voucherPic,'https://test/a');assert.equal(submitted.revision,'v1');assert.equal(storage[page.draftKey],undefined)
 input('dcSaleMoney','42');revision='v2';await page.load();assert.equal(page.data.conflict,true);assert.equal(page.data.values.dcSaleMoney,'42');accept=false;page.reloadLatest();assert.equal(storage[page.draftKey].values.dcSaleMoney,'42');accept=true;page.reloadLatest();await new Promise(r=>setImmediate(r));assert.equal(page.data.conflict,false);assert.equal(storage[page.draftKey],undefined);assert.equal(page.revision,'v2')
 console.log('营业数据版本冲突、草稿保护、识别防覆盖和提交未知状态检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
