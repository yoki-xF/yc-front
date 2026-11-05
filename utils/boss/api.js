const { request, sameSession } = require('../request')
const { getResource, can, recordView, query } = require('./resources')
function active(session) {
  const current = wx.getStorageSync('yc_session')
  if (!session || !sameSession(session, current)) throw Error('账号已变化，请重新进入')
  return current
}
function header(session) { const s = active(session); return { Authorization: 'Bearer ' + s.accessToken, 'tenant-id': String(s.tenantId) } }
async function identity(session) {
  const info = await request('/system/auth/get-permission-info', { header: header(session) })
  active(session)
  if (!info || !info.user || info.user.id == null || !Array.isArray(info.permissions)) throw Error('账号权限数据不完整，请重新登录')
  return info
}
async function allowed(session, key, action = 'list') {
  const r = getResource(key), info = await identity(session)
  if (!can(info.permissions, action === 'detail' ? (r.detailPermission || r.permission) : r.permission)) throw Error('当前账号没有此功能权限')
  return { ...r, permissions: info.permissions, actorId:String(info.user.id) }
}
async function list(session, key, filters, pageNo) {
  const resource = await allowed(session, key)
  const result = await request((resource.queryBase || resource.base) + '/page', { data: query(key, filters, pageNo), header: header(session) })
  active(session)
  if (!result || !Array.isArray(result.list) || !Number.isInteger(Number(result.total)) || Number(result.total) < 0) throw Error('列表数据不完整，请重试')
  return { canExport:can(resource.permissions,actionPermission(resource,'export')), rows: result.list.map((x, index) => Object.assign(recordView(key, x), { key: key + ':' + pageNo + ':' + index, canOpen: recordView(key,x).canOpen && can(resource.permissions, resource.detailPermission || resource.permission) })), total: Number(result.total), canCreate: result.writeScopeAllowed!==false && ['materials','roles','users','costs','attendance'].includes(key) && can(resource.permissions,actionPermission(resource,'create')) }
}
async function detail(session, key, id) {
  if (!/^[1-9]\d*$/.test(String(id))) throw Error('记录编号无效')
  const resource = await allowed(session, key, 'detail')
  if (resource.detail === false) throw Error('此类记录暂不支持详情')
  const result = await request((resource.queryBase || resource.base) + '/get', { data: { id }, header: header(session) })
  active(session)
  if (!result || String(result.id) !== String(id)) throw Error('记录不存在或无权访问')
  const view = recordView(key, result)
  view.revision=result.revision
  view.canDelete=['costs','materials','attendance'].includes(key) && result.writeScopeAllowed!==false && typeof result.revision==='string' && can(resource.permissions,actionPermission(resource,'delete'))
  view.canViewVouchers=key==='business'
  view.canEdit=result.writeScopeAllowed!==false && ['materials','roles','users','costs','attendance'].includes(key) && can(resource.permissions,actionPermission(resource,'update'))
  view.canManageUser=key==='users'&&String(id)!==resource.actorId&&['system:user:update','system:user:update-password','system:permission:assign-user-role'].some(p=>can(resource.permissions,p))
  view.canManageRole=key==='roles'&&['system:permission:assign-role-menu','system:permission:assign-role-data-scope'].some(p=>can(resource.permissions,p))
  const financial=['inventory','funds','business','commission'].includes(key)
  view.canCorrect=financial && !!result.correctionSupported && can(resource.permissions,actionPermission(resource,'update'))
  view.correctionBlockedReason=financial && can(resource.permissions,actionPermission(resource,'update')) ? result.correctionBlockedReason || '' : ''
  view.hasCorrectionHistory=financial && result.correctionHistoryAvailable !== false
  if (key === 'inventory') {
    const lines = result.lines
    active(session)
    if (!Array.isArray(lines)) throw Error('票据明细数据不完整')
    view.lines = lines.map((x, index) => ({ index, name: x.materialName || '未记录票种', money: x.money == null ? '—' : String(x.money), price: x.price == null ? '—' : String(x.price), packages: x.invPackageNum == null ? '—' : String(x.invPackageNum), sheets: x.invZhangNum == null ? '—' : String(x.invZhangNum) }))
  }
  return view
}
function actionPermission(resource, action) { return resource.base.slice(1).replace('/', ':') + ':' + action }
async function options(session) {
  const rows = await request('/sport/boss/departments', { header: header(session) })
  active(session)
  if (!Array.isArray(rows)) throw Error('门店选项数据不完整')
  return rows.filter(d => d && d.id != null && d.name)
}
async function form(session,key,id) {
  const {fields}=require('./forms'), resource=getResource(key), info=await identity(session)
  if(!can(info.permissions,actionPermission(resource,id?'update':'create')))throw Error('当前账号没有此操作权限')
  fields(key,!!id)
  let record={}
  if(id) {
    if(!/^[1-9]\d*$/.test(String(id)))throw Error('记录编号无效')
    if(!can(info.permissions,resource.detailPermission||resource.permission))throw Error('当前账号没有记录查询权限')
    record=await request((resource.queryBase||resource.base)+'/get',{data:{id},header:header(session)})
    active(session);if(!record||String(record.id)!==String(id))throw Error('记录不存在或无权访问');if(record.writeScopeAllowed===false)throw Error('此账号或角色不能在此编辑，请由其他管理员核对处理')
  }
  const departments=['users','costs'].includes(key)?await options(session):[]
  let posts=[]
  if(key==='users'){
    posts=await request('/system/boss/directory/users/post-options',{data:id?{userId:id}:{},header:header(session)})
    active(session);if(!Array.isArray(posts)||posts.some(p=>!p||typeof p.id!=='string'||!/^[1-9]\d*$/.test(p.id)))throw Error('岗位选项数据不完整')
  }
  return {record,departments,posts}
}
async function save(session,key,values,original,departments,posts) {
  const {payload}=require('./forms'), resource=getResource(key), data=payload(key,values,original,departments,posts)
  const info=await identity(session), action=original&&original.id!=null?'update':'create'
  if(!can(info.permissions,actionPermission(resource,action)))throw Error('当前账号没有此操作权限')
  if(resource.writeBase&&action==='update'){if(!original.revision)throw Error('记录版本缺失，请重新读取');data.revision=original.revision}
  const auth=header(session)
  try { const result=await request((resource.writeBase||resource.base)+'/'+action,{method:action==='create'?'POST':'PUT',data,header:auth}); active(session); if(action==='update'?result!==true:!/^[1-9]\d*$/.test(String(result)))throw Error('未取得保存结果，请核对列表');return result }
  catch(error) { error.mayHaveWritten=error.code==null || error.code>=500&&error.code<600; throw error }
}
async function removeCatalog(session,key,id,revision) {
  if(!['costs','materials','attendance'].includes(key)||!/^[1-9]\d*$/.test(String(id)) || !/^[a-f0-9]{64}$/.test(revision||''))throw Error('记录或版本无效，请重新读取')
  const resource=getResource(key),info=await identity(session);if(!can(info.permissions,actionPermission(resource,'delete')))throw Error('当前账号没有删除权限')
  try { const result=await request(key==='attendance'?'/sport/boss/admin-schedule/cancel':'/sport/boss/catalog/'+key+'/delete',{method:'POST',data:{id:String(id),revision},header:header(session)});active(session);if(result!==true)throw Error('未取得删除结果');return result }
  catch(e) {e.mayHaveWritten=e.code==null||e.code>=500&&e.code<600;throw e}
}

async function correctionRecord(session,key,id) {
  const r=getResource(key), info=await identity(session)
  if(!r.queryBase || !can(info.permissions,r.permission))throw Error('当前账号没有更正记录查询权限')
  const record=await request(r.queryBase+'/get',{data:{id},header:header(session)});active(session)
  if(!record||String(record.id)!==String(id)||(record.correctionSupported&&!record.revision))throw Error('更正数据不完整，请重新进入')
  record.canCorrect=!!record.correctionSupported && can(info.permissions,actionPermission(r,'update'))
  record.actorId=String(info.user.id)
  return record
}
async function correctionHistory(session,key,id) { getResource(key);const result=await request('/sport/boss/corrections/history',{data:{type:key,id},header:header(session)});active(session);if(!Array.isArray(result))throw Error('更正记录读取失败');return result }
async function correctionPreview(session,command) { const result=await request('/sport/boss/corrections/preview',{method:'POST',data:command,header:header(session)});active(session);if(!result||!result.revision||!Array.isArray(result.changes))throw Error('预览结果不完整');return result }
async function correctionApply(session,command) { const auth=header(session);try{const result=await request('/sport/boss/corrections/apply',{method:'POST',data:command,header:auth});active(session);if(!result||result.status!=='APPLIED'||!result.auditId)throw Error('未取得更正结果');return result}catch(e){e.mayHaveWritten=e.code==null || e.code>=500&&e.code<600;throw e} }
async function capabilities(session){const result=await request('/sport/boss/capabilities',{header:header(session)});active(session);if(!result||typeof result.reportsEnabled!=='boolean'||typeof result.correctionsEnabled!=='boolean')throw Error('功能状态数据不完整');return result}
async function profile(session){
  const info=await identity(session)
  const result=await request('/system/user/profile/get',{header:header(session)})
  active(session)
  if(!result || String(result.id)!==String(info.user.id))throw Error('个人资料与当前账号不一致，请重新登录')
  return result
}
async function saveProfile(session,values,original,password=false){
  const {profilePayload,passwordPayload}=require('./profile')
  const data=password?passwordPayload(values):profilePayload(values,original)
  const auth=header(session)
  try{
    const result=await request('/system/user/profile/'+(password?'update-password':'update'),{method:'PUT',data,header:auth})
    active(session)
    if(result!==true)throw Error('未取得保存结果')
    return result
  }catch(e){e.mayHaveWritten=e.code==null || e.code>=500&&e.code<600;throw e}
}
module.exports = { identity, list, detail, active, options, form, save, removeCatalog, actionPermission, correctionRecord, correctionHistory, correctionPreview, correctionApply, profile, saveProfile, capabilities }
