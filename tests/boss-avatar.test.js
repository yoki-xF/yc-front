const assert=require('node:assert/strict'),Module=require('node:module'),load=Module._load
let session={tenantId:1,accessToken:'synthetic-avatar'},upload,choose
global.wx={getStorageSync:()=>session,uploadFile:o=>{upload=o},chooseMedia:o=>{choose=o}}
Module._load=function(name,parent,main){if(name==='../config')return {apiBase:'https://test.invalid/admin-api'};if(name==='../request')return {request(){},sameSession:(a,b)=>!!a&&!!b&&a.tenantId===b.tenantId&&a.accessToken===b.accessToken};return load.call(this,name,parent,main)}
const avatar=require('../utils/boss/avatar');Module._load=load
async function run(){
  let p=avatar.choose();choose.fail({errMsg:'chooseMedia:fail cancel'});assert.equal(await p,null)
  p=avatar.choose();choose.success({tempFiles:[{tempFilePath:'/tmp/synthetic',size:3*1024*1024}]});await assert.rejects(p,/2MB/)
  p=avatar.choose();choose.success({tempFiles:[{tempFilePath:'/tmp/synthetic',size:100}]});assert.equal(await p,'/tmp/synthetic')
  p=avatar.upload(session,'/tmp/synthetic');assert.equal(upload.name,'avatarFile');assert.equal(upload.header.Authorization,'Bearer synthetic-avatar');assert.ok(!upload.url.includes('synthetic-avatar'))
  upload.success({statusCode:200,data:JSON.stringify({code:0,data:'https://test.invalid/avatar.png'})});assert.equal(await p,'https://test.invalid/avatar.png')
  p=avatar.upload(session,'/tmp/synthetic');upload.fail();await assert.rejects(p,e=>e.mayHaveWritten===true)
  p=avatar.upload(session,'/tmp/synthetic');session={tenantId:2,accessToken:'other'};upload.success({statusCode:200,data:JSON.stringify({code:0,data:'https://test.invalid/avatar.png'})});await assert.rejects(p,/账号已变化/)
  p=avatar.upload(session,'/tmp/synthetic');upload.success({statusCode:401,data:'{"code":401}'});await assert.rejects(p,e=>!e.mayHaveWritten&&/登录已过期/.test(e.message))
  console.log('头像选择/大小、认证上传、结果不明不重试及跨账号响应检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
