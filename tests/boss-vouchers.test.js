const assert=require('node:assert/strict')
const Module=require('node:module'),load=Module._load
let session={tenantId:1,accessToken:'test'},response,download,deleted=[]
global.wx={getStorageSync:()=>session,downloadFile:o=>{download=o},getFileSystemManager:()=>({unlink:o=>deleted.push(o.filePath)})}
Module._load=function(name,parent,main){
  if(name==='../config')return {apiBase:'https://test.invalid/admin-api'}
  if(name==='../request')return {request:async()=>response,sameSession:(a,b)=>a&&b&&a.tenantId===b.tenantId&&a.accessToken===b.accessToken}
  return load.call(this,name,parent,main)
}
const vouchers=require('../utils/boss/vouchers');Module._load=load
const revision='a'.repeat(64)
async function run(){
  response={revision,items:[{index:0,label:'untrusted'}]}
  assert.deepEqual(await vouchers.list(session,'9007199254740993'),{revision,items:[{index:0,label:'营业凭证 1'}]})
  response={revision,items:[{index:99}]};await assert.rejects(vouchers.list(session,1),/不完整/)
  let pending=vouchers.download(session,7,0,revision,()=>true)
  assert.equal(download.header.Authorization,'Bearer test');assert.equal(download.header['tenant-id'],'1')
  assert.ok(!download.url.includes('test&'));assert.ok(!download.url.includes('Bearer'))
  download.success({statusCode:200,header:{'Content-Type':'image/png'},tempFilePath:'/tmp/image'})
  assert.equal(await pending,'/tmp/image')
  pending=vouchers.download(session,7,0,revision,()=>false)
  download.success({statusCode:200,header:{'content-type':'image/png'},tempFilePath:'/tmp/left'})
  await assert.rejects(pending,/离开/);assert.ok(deleted.includes('/tmp/left'))
  pending=vouchers.download(session,7,0,revision,()=>true)
  session={tenantId:2,accessToken:'other'}
  download.success({statusCode:200,header:{'content-type':'image/png'},tempFilePath:'/tmp/old-account'})
  await assert.rejects(pending,/账号已变化/);assert.ok(deleted.includes('/tmp/old-account'))
  pending=vouchers.download(session,7,0,revision,()=>true)
  download.success({statusCode:200,header:{'content-type':'application/json'},tempFilePath:'/tmp/error'})
  await assert.rejects(pending,/无法读取/);assert.ok(deleted.includes('/tmp/error'))
  let page;global.Page=p=>{page=p};require('../pages/boss/vouchers/index')
  const instance={...page,paths:new Set(['/tmp/visible']),version:1,data:{items:[{path:'/tmp/visible'}]},setData(p){Object.assign(this.data,p)}}
  page.onHide.call(instance);assert.equal(instance.disposed,true);assert.equal(instance.paths.size,0);assert.deepEqual(instance.data.items,[])
  assert.ok(deleted.includes('/tmp/visible'))
  console.log('凭证列表校验、认证下载、异常内容拒绝、离页及换账号清理通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
