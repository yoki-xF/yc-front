const {request,sameSession}=require('../request')
function headers(session){const current=wx.getStorageSync('yc_session');if(!sameSession(session,current))throw Error('账号已切换，请返回重新进入');return {Authorization:'Bearer '+current.accessToken,'tenant-id':String(current.tenantId)}}
async function call(session,path,options={}){const result=await request('/system/admin-native/posts/'+path,{...options,header:headers(session)});headers(session);return result}
function page(session,pageNo,search){return call(session,'page',{data:{pageNo,pageSize:20,search}})}
function detail(session,id){if(!/^[1-9]\d*$/.test(String(id)))throw Error('岗位编号无效');return call(session,'get',{data:{id:String(id)}})}
function save(session,data){return call(session,'save',{method:'POST',data})}
module.exports={page,detail,save,headers}
