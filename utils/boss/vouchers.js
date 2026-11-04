const api = require('./api')
const { request } = require('../request')
const { apiBase } = require('../config')
function remove(path) { if(path)wx.getFileSystemManager().unlink({filePath:path,fail(){}}) }
function auth(session) { const s=api.active(session);return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)} }
function recordId(id) { if(!/^[1-9]\d*$/.test(String(id)))throw Error('记录编号无效') }
async function list(session,id) {
  recordId(id)
  const result=await request('/sport/boss/business-vouchers/list',{data:{id},header:auth(session)})
  api.active(session)
  if(!result||!/^[a-f0-9]{64}$/.test(result.revision)||!Array.isArray(result.items)||result.items.length>6||result.items.some((x,i)=>!x||x.index!==i))throw Error('凭证信息不完整')
  return {revision:result.revision,items:result.items.map(x=>({index:x.index,label:'营业凭证 '+(x.index+1)}))}
}
function download(session,id,index,revision,current) {
  recordId(id)
  if(!Number.isInteger(index)||index<0||index>5||!/^[a-f0-9]{64}$/.test(revision))return Promise.reject(Error('凭证编号无效'))
  const header=auth(session)
  if(!apiBase)return Promise.reject(Error('请先配置测试服务地址'))
  return new Promise((resolve,reject)=>wx.downloadFile({
    url:apiBase.replace(/\/$/,'')+'/sport/boss/business-vouchers/content?id='+encodeURIComponent(id)+'&index='+index+'&revision='+revision,
    header,timeout:20000,
    success(res) {
      try {
        api.active(session)
        if(!current())throw Error('页面已离开，请重新查看')
        const headers=res.header||{},mime=String(headers['Content-Type']||headers['content-type']||'').split(';')[0].toLowerCase()
        if(res.statusCode!==200||!/^image\/(jpeg|png|webp)$/.test(mime)||!res.tempFilePath)throw Error(res.statusCode===401?'登录已过期，请重新进入':'凭证无法读取，请刷新或联系管理员核对')
        resolve(res.tempFilePath)
      }catch(e){remove(res.tempFilePath);reject(e)}
    },fail(){reject(Error('凭证下载失败，请检查网络后重试'))}
  }))
}
module.exports={list,download,remove}
