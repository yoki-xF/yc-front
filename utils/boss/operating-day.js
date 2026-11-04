const api=require('./api')
const {request}=require('../request')
const {can}=require('./resources')
const base='/sport/business-day'
function id(value){if(typeof value==='number'&&!Number.isSafeInteger(value))throw Error('门店编号无效');if(!/^[1-9]\d*$/.test(String(value)))throw Error('请选择门店');return String(value)}
function key(value){if(!/^[A-Za-z0-9-]{16,80}$/.test(value||''))throw Error('请求标识无效');return value}
function state(value,dept,statuses){
  if(!value||String(value.deptId)!==id(dept)||!statuses.includes(value.status)||!/^\d{4}-\d{2}-\d{2}$/.test(value.businessDate||''))throw Error('营业日状态不完整，请重新读取')
  if(value.status!=='NOT_OPEN'&&(!/^[a-f0-9-]{36}$/.test(value.id||'')||!/^[1-9]\d*$/.test(String(value.revision))))throw Error('营业日标识无效，请重新读取')
  return value
}
async function call(session,path,dept,data){
  const current=api.active(session),writing=!!data
  try{
    const result=await request(base+path,{method:writing?'POST':'GET',data:data||{deptId:id(dept)},header:{Authorization:'Bearer '+current.accessToken,'tenant-id':String(current.tenantId)}})
    api.active(session);return result
  }catch(e){if(writing)e.mayHaveWritten=e.code==null||e.code>=500&&e.code<600;throw e}
}
async function permissions(session){const info=await api.identity(session);return {actor:String(info.user.id),query:can(info.permissions,'sport:business-day:query'),open:can(info.permissions,'sport:business-day:open'),close:can(info.permissions,'sport:business-day:close')}}
async function current(session,dept){return state(await call(session,'/current',dept),dept,['NOT_OPEN','OPEN'])}
async function preview(session,dept){
  const result=state(await call(session,'/closing-preview',dept),dept,['READY_TO_CLOSE'])
  if(!/^[a-f0-9]{64}$/.test(result.sourceRevision||'')||!Array.isArray(result.funds)||result.funds.length!==5||!result.report||result.report.ruleVersion!=='store-five-funds-three-sales-v1')throw Error('结店预览不完整，请重新读取')
  for(const field of ['openingFunds','closingFunds','reserveIn','instantSales','electronicSales','sportsBettingSales','totalSales','adjustments','wrongTicket','variance'])if(!/^-?\d+\.\d{2}$/.test(result.report[field]||''))throw Error('结店金额不完整，请重新读取')
  const labels={xj:'现金',wxBalance:'微信余额',hsk:'收银通',zfb:'支付宝',szRmb:'数字人民币'}
  if(new Set(result.funds.map(f=>f.key)).size!==5)throw Error('结店资金重复，请重新读取')
  result.funds=result.funds.map(f=>{if(!labels[f.key]||!['opening','closing'].every(k=>/^-?\d+(\.\d{1,2})?$/.test(String(f[k]))))throw Error('结店资金不完整');return {...f,label:labels[f.key]}})
  return result
}
function command(action,dept,requestKey,value){
  const data={deptId:id(dept),requestKey:key(requestKey)}
  if(action==='close'){
    state(value,dept,['READY_TO_CLOSE'])
    if(!/^[a-f0-9]{64}$/.test(value.sourceRevision||'')||!Number.isSafeInteger(Number(value.revision)))throw Error('请重新预览后结店')
    Object.assign(data,{dayId:value.id,revision:Number(value.revision),sourceRevision:value.sourceRevision})
  }else if(action!=='open')throw Error('操作无效')
  return {action,data}
}
async function write(session,pending){
  if(!pending||!['open','close'].includes(pending.action)||!pending.data)throw Error('待确认请求无效')
  id(pending.data.deptId);key(pending.data.requestKey)
  const value=await call(session,'/'+pending.action,pending.data.deptId,pending.data)
  try{return state(value,pending.data.deptId,pending.action==='open'?['OPEN','CLOSED']:['CLOSED'])}catch(e){e.mayHaveWritten=true;throw e}
}
module.exports={permissions,current,preview,command,write}
