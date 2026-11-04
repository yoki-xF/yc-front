const {request}=require('../request')
const api=require('./api')
const {can}=require('./resources')
const permissions={status:'system:user:update',password:'system:user:update-password',roles:'system:permission:assign-user-role'}
function header(session){const s=api.active(session);return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)}}
async function allowed(session,action){const info=await api.identity(session);if(!can(info.permissions,'system:user:query')||!(action?can(info.permissions,permissions[action]):Object.values(permissions).some(p=>can(info.permissions,p))))throw Error('当前账号没有此账号管理权限');return info}
async function get(session,id){await allowed(session);const result=await request('/system/boss/user-actions/get',{data:{id},header:header(session)});api.active(session);if(!result||String(result.id)!==String(id)||!result.revision||!Array.isArray(result.roles)||!Array.isArray(result.roleIds))throw Error('账号管理信息不完整');return result}
function payload(action,record,values){
  if(!Object.hasOwnProperty.call(permissions,action)||!record||!record.id||!record.revision)throw Error('请重新读取账号信息')
  const data={id:String(record.id),revision:record.revision}
  if(action==='status'){if(!record.canStatus||![0,1].includes(Number(values.status)))throw Error('没有权限或状态无效');data.status=Number(values.status)}
  else if(action==='password'){if(!record.canReset)throw Error('没有密码重置权限');if(typeof values.password!=='string'||values.password.length<4||values.password.length>16)throw Error('新密码长度为4至16位');if(values.password!==values.confirmation)throw Error('两次输入的新密码不一致');data.password=values.password}
  else{if(!record.canAssign||!Array.isArray(values.roleIds)||values.roleIds.length>100)throw Error('角色选择无效');if(values.roleIds.some(id=>!record.roles.some(r=>String(r.id)===String(id))))throw Error('包含不可分配的角色');const disabled=record.roles.filter(r=>r.disabled&&record.roleIds.map(String).includes(String(r.id)));if(disabled.some(r=>!values.roleIds.map(String).includes(String(r.id))))throw Error('请保留已停用角色，交由原管理后台核对');data.roleIds=[...new Set(values.roleIds.map(String))]}
  return data
}
async function save(session,action,record,values){const data=payload(action,record,values);await allowed(session,action);try{const result=await request('/system/boss/user-actions/'+action,{method:'PUT',data,header:header(session)});api.active(session);if(result!==true)throw Error('未取得操作结果');return result}catch(e){e.mayHaveWritten=e.code==null||e.code>=500&&e.code<600;throw e}}
module.exports={get,payload,save}
