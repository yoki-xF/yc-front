const {request}=require('../request')
const api=require('./api')
const {can}=require('./resources')
const fields=[
  {key:'personalSalesEnabled',label:'按员工记录个人销量',hint:'个人仅统计电彩、竞彩；库存、资金和盈亏仍归门店。'},
  {key:'sportsSalesEnabled',label:'启用竞彩销售',hint:'开启后显示竞彩销售录入。'},
  {key:'employeeProfitVisible',label:'员工可查看门店盈亏',hint:'展示门店结果，不分摊个人盈亏；仍受报表权限限制。'},
  {key:'morningFundsHidden',label:'隐藏早盘资金参考金额',hint:'影响早盘参考金额的展示，不清除门店资金记录。'}
]
function header(session){const s=api.active(session);return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)}}
async function allowed(session,write){const info=await api.identity(session);if(!can(info.permissions,'system:service-config:query')||write&&!can(info.permissions,'system:service-config:update'))throw Error('当前账号没有经营设置权限')}
function valid(record){return record&&typeof record.revision==='string'&&record.revision.length>0&&typeof record.canSave==='boolean'&&typeof record.locked==='boolean'&&typeof record.reason==='string'&&record.values&&fields.every(f=>typeof record.values[f.key]==='boolean')}
async function get(session){await allowed(session,false);const result=await request('/system/boss/business-settings',{header:header(session)});api.active(session);if(!valid(result))throw Error('经营设置信息不完整');return result}
function payload(record,values,reason){
  if(!valid(record)||!record.canSave||record.locked)throw Error(record&&record.reason||'当前不能修改经营设置')
  if(!values||fields.some(f=>typeof values[f.key]!=='boolean'))throw Error('请选择有效的经营设置')
  const text=String(reason||'').trim();if(text.length<5||text.length>200)throw Error('请填写5至200字的设置原因')
  return {revision:record.revision,values:Object.fromEntries(fields.map(f=>[f.key,values[f.key]])),reason:text}
}
async function save(session,record,values,reason){const data=payload(record,values,reason);await allowed(session,true);try{const result=await request('/system/boss/business-settings',{method:'PUT',data,header:header(session)});api.active(session);if(!valid(result))throw Error('未取得有效的设置保存结果');return result}catch(error){error.mayHaveWritten=error.code==null||error.code>=500&&error.code<600;throw error}}
module.exports={fields,get,payload,save,valid}
