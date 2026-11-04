const {apiBase}=require('../config'),api=require('./api'),{getResource,can,query}=require('./resources')
function unlink(path){if(path)try{wx.getFileSystemManager().unlink({filePath:path,fail(){}})}catch(_) {}}
async function download(session,type,filters){
 const resource=getResource(type);if(type==='roles')throw Error('此类型没有表格导出');query(type,filters,1);const info=await api.identity(session);if(!can(info.permissions,resource.permission)||!can(info.permissions,api.actionPermission(resource,'export')))throw Error('没有此业务导出权限');
 const args={keyword:filters.keyword||'',deptId:filters.deptId||'',start:filters.start||'',end:filters.end||''},params=Object.entries(args).filter(([,v])=>v!=='').map(([k,v])=>encodeURIComponent(k)+'='+encodeURIComponent(v)).join('&');const path=type==='users'?'/system/admin-native/user-export':'/sport/boss/admin-export/'+type,current=api.active(session);
 return new Promise((resolve,reject)=>wx.downloadFile({url:apiBase.replace(/\/$/,'')+path+'?'+params,header:{Authorization:'Bearer '+current.accessToken,'tenant-id':String(current.tenantId)},success:r=>{try{api.active(session);const h=r.header||{},ct=Object.keys(h).find(k=>k.toLowerCase()==='content-type');if(r.statusCode!==200||!r.tempFilePath||!ct||!String(h[ct]).toLowerCase().includes('text/csv'))throw Error('导出失败，请核对权限、登录状态或缩小范围');resolve(r.tempFilePath)}catch(e){unlink(r.tempFilePath);reject(e)}},fail:()=>reject(Error('下载失败，请重试'))}))
}
module.exports={download,unlink}
