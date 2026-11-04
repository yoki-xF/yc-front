const api=require('./api')
const {apiBase}=require('../config')
function choose(){return new Promise((resolve,reject)=>wx.chooseMedia({count:1,mediaType:['image'],sourceType:['album','camera'],sizeType:['compressed'],success(r){const f=r.tempFiles&&r.tempFiles[0];if(!f||!f.tempFilePath||!Number.isFinite(f.size)||f.size<=0||f.size>2*1024*1024)return reject(Error('请选择2MB以内的头像图片'));resolve(f.tempFilePath)},fail(e){if(e&&/cancel/.test(e.errMsg||''))resolve(null);else reject(Error('无法选择图片，请检查相册或相机权限'))}}))}
function upload(session,path){
  const s=api.active(session)
  if(!apiBase||!path)return Promise.reject(Error('头像上传信息不完整'))
  return new Promise((resolve,reject)=>wx.uploadFile({url:apiBase.replace(/\/$/,'')+'/system/boss/profile/avatar',filePath:path,name:'avatarFile',header:{Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)},timeout:20000,
    success(r){
      let body;try{body=JSON.parse(r.data)}catch(_){const e=Error('头像保存结果尚未确认，请重新读取资料核对');e.mayHaveWritten=true;return reject(e)}
      try{api.active(session)}catch(e){return reject(e)}
      if(r.statusCode!==200||!body||body.code!==0){const e=Error(r.statusCode===401||body&&body.code===401?'登录已过期，请重新进入':body&&body.msg||'头像上传失败');e.mayHaveWritten=r.statusCode>=500;return reject(e)}
      if(typeof body.data!=='string'||body.data.length>2048||!/^https?:\/\//.test(body.data)){const e=Error('头像保存结果尚未确认，请重新读取资料核对');e.mayHaveWritten=true;return reject(e)}
      resolve(body.data)
    },fail(){const e=Error('头像保存结果尚未确认，请检查网络并重新读取资料');e.mayHaveWritten=true;reject(e)}
  }))
}
module.exports={choose,upload}
