const {request,sameSession}=require('../request')
const {utf8Bytes}=require('../admin-infra/json-size')
function current(session){const live=wx.getStorageSync('yc_session');if(!sameSession(session,live))throw Error('账号已切换，请重新进入');return live}
function unlink(path){try{wx.getFileSystemManager().unlink({filePath:path,fail:()=>{}})}catch(_){}}
async function exportFile(session,kind,search,dictType,filter={}){
 if(!['posts','dict-types','dict-data','tenants','login','operate'].includes(kind))throw Error('不支持此导出类型');const live=current(session)
 const text=await request('/system/admin-native/exports/'+kind,{data:{search,dictType,...Object.fromEntries(['userId','keyword','startDate','endDate'].filter(k=>filter[k]!=null&&filter[k]!=='').map(k=>[k,filter[k]]))},header:{Authorization:'Bearer '+live.accessToken,'tenant-id':String(live.tenantId)}});current(session)
 if(typeof text!=='string'||utf8Bytes(text)>1000000)throw Error('导出内容无效或超过1MB');const path=wx.env.USER_DATA_PATH+'/admin-export-'+kind+'-'+Date.now()+'-'+Math.random().toString(36).slice(2)+'.csv'
 try{await new Promise((resolve,reject)=>wx.getFileSystemManager().writeFile({filePath:path,data:'\ufeff'+text,encoding:'utf8',success:resolve,fail:()=>reject(Error('无法写入导出文件'))}));current(session);if(typeof wx.shareFileMessage!=='function')throw Error('当前客户端不支持文件分享');await new Promise((resolve,reject)=>wx.shareFileMessage({filePath:path,fileName:kind+'.csv',success:resolve,fail:()=>reject(Error('文件分享未完成'))}))}finally{unlink(path)}
}
module.exports={exportFile}
