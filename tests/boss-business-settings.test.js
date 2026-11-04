const assert=require('node:assert/strict'),Module=require('node:module')
let calls=[],response,permissions=['system:service-config:query','system:service-config:update']
const fake={active:()=>({tenantId:8,accessToken:'synthetic'}),identity:async()=>({permissions})}
const original=Module._load
Module._load=function(name,parent,main){if(name==='./api')return fake;if(name==='../request')return{request:async(path,options)=>{calls.push({path,options});if(response instanceof Error)throw response;return response}};return original.call(this,name,parent,main)}
const settings=require('../utils/boss/business-settings');Module._load=original
const values=Object.fromEntries(settings.fields.map(f=>[f.key,false]))
const record={revision:'revision-1',values,canSave:true,locked:false,reason:''}
assert.equal(settings.valid(record),true)
assert.equal(settings.valid({...record,values:{...values,sportsSalesEnabled:0}}),false)
assert.throws(()=>settings.payload({...record,locked:true},values,'准备新门店营业'),/修改/)
assert.throws(()=>settings.payload(record,{...values,personalSalesEnabled:'true'},'准备新门店营业'),/有效/)
assert.throws(()=>settings.payload(record,values,'短'),/原因/)
assert.deepEqual(settings.payload(record,{...values,tenantId:999,id:99},'准备新门店营业'),{revision:'revision-1',values,reason:'准备新门店营业'})
async function run(){
 response=record;assert.deepEqual(await settings.get({}),record)
 response=record;await settings.save({},record,values,'准备新门店营业');assert.equal(calls.at(-1).options.method,'PUT');assert.equal(calls.at(-1).options.header['tenant-id'],'8')
 permissions=['system:service-config:query'];const count=calls.length;await assert.rejects(settings.save({},record,values,'准备新门店营业'),/权限/);assert.equal(calls.length,count)
 permissions.push('system:service-config:update');response=Error('timeout');await assert.rejects(settings.save({},record,values,'准备新门店营业'),error=>error.mayHaveWritten===true)
 response=Object.assign(Error('stale'),{code:10086});await assert.rejects(settings.save({},record,values,'准备新门店营业'),error=>error.mayHaveWritten===false)
 console.log('经营设置权限、四项布尔值、版本、请求白名单和未知结果防重检查通过')
}
run().catch(error=>{console.error(error);process.exitCode=1})
