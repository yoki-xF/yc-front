const {request}=require('../request'),api=require('./api'),{can}=require('./resources')
const permissions={menus:'system:permission:assign-role-menu',scope:'system:permission:assign-role-data-scope'}
const scopes=[{id:1,name:'本组织全部数据'},{id:2,name:'指定门店数据'},{id:3,name:'账号所属部门数据'},{id:4,name:'账号部门及下级部门数据'},{id:5,name:'仅本人数据'}]
function header(session){const s=api.active(session);return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)}}
async function allowed(session,action){const info=await api.identity(session);if(!can(info.permissions,'system:role:query')||!(action?can(info.permissions,permissions[action]):Object.values(permissions).some(p=>can(info.permissions,p))))throw Error('当前账号没有角色授权权限')}
async function get(session,id){await allowed(session);const result=await request('/system/boss/role-actions/get',{data:{id},header:header(session)});api.active(session);if(!result||String(result.id)!==String(id)||!result.revision||!['menus','menuIds','departments','deptIds'].every(k=>Array.isArray(result[k])))throw Error('角色授权信息不完整');return result}
function payload(action,record,values){
 if(!Object.prototype.hasOwnProperty.call(permissions,action)||!record||!record.id||!record.revision)throw Error('请重新读取角色信息')
 const data={id:String(record.id),revision:record.revision}
 if(action==='menus'){
  if(!record.canMenus||!Array.isArray(values.menuIds)||values.menuIds.length>2000||values.menuIds.some(id=>!record.menus.some(m=>String(m.id)===String(id))))throw Error('包含不可分配的功能权限')
  data.menuIds=[...new Set(values.menuIds.map(String))]
 }else{
  const scope=Number(values.dataScope)
  if(!record.canScope||!scopes.some(s=>s.id===scope))throw Error('请选择有效数据范围')
  data.dataScope=scope;data.deptIds=[]
  if(scope===2){if(!Array.isArray(values.deptIds)||!values.deptIds.length||values.deptIds.length>500||values.deptIds.some(id=>!record.departments.some(d=>String(d.id)===String(id))))throw Error('请选择可用门店');data.deptIds=[...new Set(values.deptIds.map(String))]}
 }
 return data
}
function menuLabels(menus){const index=new Map(menus.map(m=>[String(m.id),m]));return menus.map(m=>{const names=[m.name],visited=new Set([String(m.id)]);let parent=index.get(String(m.parentId));while(parent&&visited.size<12&&!visited.has(String(parent.id))){names.unshift(parent.name);visited.add(String(parent.id));parent=index.get(String(parent.parentId))}return {...m,label:names.join(' / ')}})}
function mergeSelection(current,visible,selected){const visibleIds=new Set(visible.map(m=>String(m.id)));return [...new Set([...current.map(String).filter(id=>!visibleIds.has(id)),...selected.map(String)])]}
async function save(session,action,record,values){const data=payload(action,record,values);await allowed(session,action);try{const result=await request('/system/boss/role-actions/'+action,{method:'PUT',data,header:header(session)});api.active(session);if(result!==true)throw Error('未取得授权保存结果');return result}catch(e){e.mayHaveWritten=e.code==null||e.code>=500&&e.code<600;throw e}}
module.exports={get,payload,save,scopes,menuLabels,mergeSelection}
