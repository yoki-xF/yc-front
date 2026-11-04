const api=require('./api')
const {request}=require('../request')
const fundFields=[{key:'xj',label:'现金'},{key:'wxBalance',label:'微信余额'},{key:'hsk',label:'收银通'},{key:'zfb',label:'支付宝'},{key:'szRmb',label:'数字人民币'}]
function auth(session){const s=api.active(session);return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)}}
async function options(session){const result=await request('/sport/boss/opening/options',{header:auth(session)});api.active(session);if(!result||!Array.isArray(result.departments)||!Array.isArray(result.materials))throw Error('初始化选项不完整');return result}
async function status(session,deptId){const result=await request('/sport/boss/opening/status',{data:{deptId},header:auth(session)});api.active(session);if(!result||typeof result.initialized!=='boolean'||typeof result.canInitialize!=='boolean')throw Error('初始化状态不完整');return result}
function payload(deptId,funds,materials,reason,requestKey){
  if(!/^[1-9]\d*$/.test(String(deptId)))throw Error('请选择门店')
  const balances={}
  for(const f of fundFields){const s=String(funds[f.key]==null?'':funds[f.key]).trim();if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(s))throw Error(f.label+'须为非负金额，最多两位小数');balances[f.key]=s}
  const lines=materials.filter(m=>m.selected).map(m=>{
    if(!/^[1-9]\d*$/.test(String(m.id))||!/^[a-f0-9]{64}$/.test(m.revision||''))throw Error('票种资料不完整，请重新读取')
    const counts={};for(const key of ['packageNum','sheetNum']){const v=String(m[key]||'0');if(!/^(0|[1-9]\d{0,6})$/.test(v)||Number(v)>1000000)throw Error('票种数量须为0至1000000的整数');counts[key]=Number(v)}
    return {materialId:String(m.id),...counts,revision:m.revision}
  })
  if(!lines.length||lines.length>500)throw Error('请至少选择一个票种，没有库存可填零')
  if(new Set(lines.map(l=>l.materialId)).size!==lines.length)throw Error('票种不能重复')
  reason=String(reason||'').trim();if(reason.length<5||reason.length>500)throw Error('请填写5至500字的启用说明')
  if(!/^[A-Za-z0-9-]{16,80}$/.test(requestKey||''))throw Error('请求编号无效')
  return {deptId:String(deptId),requestKey,reason,funds:balances,lines}
}
async function apply(session,body){const header=auth(session);try{const result=await request('/sport/boss/opening/apply',{method:'POST',data:body,header});api.active(session);if(!result||result.status!=='INITIALIZED'||String(result.deptId)!==String(body.deptId))throw Error('初始化结果尚未确认');return result}catch(e){e.mayHaveWritten=e.code==null||e.code>=500&&e.code<600;throw e}}
module.exports={fundFields,options,status,payload,apply}
