const {request}=require('../request')
const api=require('./api')
const {can,query}=require('./resources')
function header(session){const s=api.active(session);return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)}}
async function allowed(session,action){const info=await api.identity(session);if(!can(info.permissions,'sport:staff-schedule:query')||!can(info.permissions,'sport:staff-schedule:'+action))throw Error('当前账号没有排班操作权限')}
async function get(session,id){await allowed(session,'update');const result=await request('/sport/boss/schedules/get',{data:{id},header:header(session)});api.active(session);if(!result||String(result.id)!==String(id)||!result.revision)throw Error('排班数据不完整');return result}
async function options(session,deptId){await allowed(session,'query');const result=await request('/sport/boss/schedules/options',{data:{deptId},header:header(session)});api.active(session);if(!result||!Array.isArray(result.users)||!Array.isArray(result.configs))throw Error('排班选项不完整');return result}
function payload(values,original,departments,options){
  const dept=departments.find(d=>String(d.id)===String(values.deptId)),user=options.users.find(u=>String(u.id)===String(values.userId)),config=options.configs.find(c=>String(c.id)===String(values.configId))
  if(!dept||!user||!config)throw Error('请选择有权限的门店、员工和班次')
  if(![1,2,3].includes(Number(values.status)))throw Error('请选择出勤状态')
  query('attendance',{start:values.date,end:values.date},1)
  const result={deptId:String(dept.id),userId:String(user.id),configId:String(config.id),date:values.date,status:Number(values.status)}
  if(original&&original.id!=null){if(String(original.deptId)!==result.deptId)throw Error('编辑时不能更换门店');if(!original.revision)throw Error('缺少排班版本，请重新读取');result.id=String(original.id);result.revision=original.revision}
  return result
}
async function save(session,values,original,departments,options){
  const data=payload(values,original,departments,options),edit=!!data.id
  await allowed(session,edit?'update':'create')
  try{const result=await request('/sport/boss/schedules/'+(edit?'update':'create'),{method:edit?'PUT':'POST',data,header:header(session)});api.active(session);if(!/^[1-9]\d*$/.test(String(result)))throw Error('未取得排班保存结果');return result}
  catch(e){e.mayHaveWritten=e.code==null||e.code>=500&&e.code<600;throw e}
}
module.exports={get,options,payload,save,allowed}
