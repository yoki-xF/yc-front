const assert=require('node:assert/strict')
const {profilePayload,passwordPayload}=require('../utils/boss/profile')
assert.deepEqual(profilePayload({nickname:' 店长 ',email:'',mobile:'',id:99,deptId:99,roles:[1]},{sex:2}),{nickname:'店长',email:'',sex:2})
assert.throws(()=>profilePayload({nickname:'店长',mobile:''},{mobile:'13800000000'}),/清空/)
assert.throws(()=>profilePayload({nickname:'店长',email:'bad'},{}),/邮箱/)
assert.deepEqual(passwordPayload({oldPassword:' old ',newPassword:' new ',confirmation:' new ',id:99}),{oldPassword:' old ',newPassword:' new '})
assert.throws(()=>passwordPayload({oldPassword:'abcd',newPassword:'efgh',confirmation:'ijkl'}),/不一致/)
assert.throws(()=>passwordPayload({oldPassword:'abcd',newPassword:'abcd',confirmation:'abcd'}),/相同/)

let session={tenantId:1,accessToken:'test-token'}, calls=[], responder
global.wx={getStorageSync(){return session}}
const Module=require('node:module'),load=Module._load
Module._load=function(name,parent,main){
  if(name==='../request')return {sameSession:(a,b)=>!!a&&!!b&&a.tenantId===b.tenantId&&a.accessToken===b.accessToken,request:async(path,options)=>{calls.push({path,options});return responder(path,options)}}
  return load.call(this,name,parent,main)
}
const api=require('../utils/boss/api');Module._load=load
async function run(){
  responder=async path=>path.endsWith('permission-info')?{user:{id:1},permissions:[]}:{id:2,nickname:'wrong user'}
  await assert.rejects(api.profile(session),/不一致/)
  responder=async()=>true;calls=[]
  await api.saveProfile(session,{nickname:'店长',id:99,deptId:999},{sex:1})
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/system/user/profile/update');assert.equal(calls[0].options.method,'PUT')
  assert.deepEqual(calls[0].options.data,{nickname:'店长',email:'',sex:1})
  responder=async()=>{throw Error('timeout')};calls=[]
  await assert.rejects(api.saveProfile(session,{oldPassword:'abcd',newPassword:'efgh',confirmation:'efgh'},{},true),e=>e.mayHaveWritten===true)
  assert.equal(calls.length,1)
  let resolve
  responder=()=>new Promise(r=>{resolve=r})
  const pending=api.saveProfile(session,{nickname:'店长'},{})
  session={tenantId:2,accessToken:'other-token'};resolve(true)
  await assert.rejects(pending,/账号已变化/)
  let page
  global.Page=p=>{page=p}
  require('../pages/boss/profile/index')
  const state={...page.data,passwords:{oldPassword:'secret',newPassword:'secret2',confirmation:'secret2'}}
  const instance={data:state,setData(p){Object.assign(this.data,p)}}
  page.onHide.call(instance)
  assert.deepEqual(instance.data.passwords,{oldPassword:'',newPassword:'',confirmation:''})
  console.log('个人资料白名单、本人身份核对、密码精度/确认、未知结果不重试及跨账号响应检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
