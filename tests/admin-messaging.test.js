const assert=require('node:assert/strict'),Module=require('node:module')
const model=require('../utils/admin-messaging/model')
const input=model.initial('sms-templates',{name:'Notice',code:'NOTICE',type:1,status:0,content:'Hi',apiTemplateId:'TPL',channelId:'9007199254740993'})
assert.equal(model.payload('sms-templates',input,false).channelId,'9007199254740993')
assert.equal(model.initial('sms-channels',{apiKey:'must-never-prefill'}).apiKey,'')
assert.throws(()=>model.payload('mail-accounts',{mail:'a',username:'b',password:'x',host:'smtp.test',port:'25.5',sslEnable:'true',starttlsEnable:'false'},false))
let current={tenantId:'1',accessToken:'token1',refreshToken:'same'},roles=['super_admin'],calls=[],deleted=[],mode='ok'
const auth={active(s){if(!s||s.tenantId!==current.tenantId||s.refreshToken!==current.refreshToken)throw Error('账号变化');return current},identity:async()=>({user:{id:'1'},roles,permissions:['*:*:*']})}
const fakeRequest=async(p,o)=>{calls.push({p,o});if(mode==='switch'){current={tenantId:'2',accessToken:'other',refreshToken:'other'};return '100'}if(mode==='unknown'){const e=Error('发送结果尚未确认');e.code=10086;throw e}return '100'}
global.wx={getStorageSync:()=>current,getFileSystemManager:()=>({unlink(o){deleted.push(o.filePath)}}),downloadFile(o){o.success({statusCode:200,tempFilePath:'/synthetic/error.json',header:{'Content-Type':'application/json'}})}}
const original=Module._load;Module._load=function(name,...args){if(name==='../request')return {request:fakeRequest};if(name==='../boss/api')return auth;if(name==='../config')return {apiBase:'https://synthetic.invalid'};return original.call(this,name,...args)}
const api=require('../utils/admin-messaging/api');Module._load=original
async function run(){const session=current,row={id:'9007199254740993',revision:'a'.repeat(64)},send={recipient:'13800000000',userType:'2',params:'{"name":"A"}'};current={...current,accessToken:'refreshed'};await api.send(session,'sms-templates',row,send,'request_1234567890');assert.equal(calls[0].o.header.Authorization,'Bearer refreshed');assert.equal(calls[0].o.data.id,row.id);assert.equal(calls[0].o.data.requestKey,'request_1234567890');assert.equal(calls[0].o.data.userType,2);assert.equal(calls.length,1)
 roles=['tenant_admin'];await assert.rejects(()=>api.send(session,'sms-templates',row,send,'request_1234567890'),/平台管理员/);assert.equal(calls.length,1);roles=['super_admin'];assert.throws(()=>api.send(session,'sms-templates',row,{...send,params:'[]'},'request_1234567890'))
 mode='unknown';await assert.rejects(()=>api.send(session,'sms-templates',row,send,'request_1234567890'),e=>e.mayHaveWritten===true);assert.equal(calls.length,2)
 mode='ok';await assert.rejects(()=>api.exportCsv(session,'sms-channels',''),/导出失败/);assert.deepEqual(deleted,['/synthetic/error.json'])
 mode='switch';await assert.rejects(()=>api.send(session,'sms-templates',row,send,'request_1234567890'),/账号变化/)
 console.log('Messaging: write-only secret inputs, exact IDs, role gate, refreshed token, no retry, uncertain result, invalid download cleanup and account switch pass')
}
run().catch(e=>{console.error(e);process.exitCode=1})
