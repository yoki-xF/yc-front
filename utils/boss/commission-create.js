const api=require('./api')
const {request}=require('../request')
const {can}=require('./resources')
function id(v){if(typeof v==='number'&&!Number.isSafeInteger(v)||!/^[1-9]\d*$/.test(String(v)))throw Error('编号无效');return String(v)}
async function call(session,path,data,write=false){const s=api.active(session);try{const result=await request('/sport/boss/commission/'+path,{method:write?'POST':'GET',data,header:{Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)}});api.active(session);return result}catch(e){if(write)e.mayHaveWritten=e.code==null||e.code>=500&&e.code<600;throw e}}
async function options(session,dept){const info=await api.identity(session);if(!can(info.permissions,'sport:check-game-sales:create'))throw Error('没有新增返佣盘点权限');const value=await call(session,'options',{deptId:id(dept)});if(!value||!value.day||value.day.status!=='OPEN'||String(value.day.deptId)!==id(dept)||!Array.isArray(value.users)||!Array.isArray(value.games)||!/^[a-f0-9]{64}$/.test(value.revision||''))throw Error('新增上下文不完整，请重新读取');return value}
function command(dept,context,values,key){
 if(!context||!context.day||context.day.status!=='OPEN'||String(context.day.deptId)!==id(dept)||!/^[a-f0-9]{64}$/.test(context.revision||''))throw Error('请先读取当前营业日')
 for(const field of ['salesAmount','commission'])if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(values[field]||''))throw Error('销售额和佣金须为非负数，最多十位整数、两位小数')
 if(!/^(0|[1-9]\d{0,2})(\.\d{1,4})?$/.test(values.rebate||'')||Number(values.rebate)>100)throw Error('返点须为0至100，最多四位小数')
 const reason=(values.reason||'').trim();if(reason.length<5||reason.length>500)throw Error('请填写5至500字的记录说明')
 const userId=id(values.userId),gameSalesId=id(values.gameSalesId)
 if(!context.users.some(x=>String(x.id)===userId)||!context.games.some(x=>String(x.id)===gameSalesId))throw Error('请选择当前可用人员和游戏')
 if(!/^[A-Za-z0-9-]{16,80}$/.test(key||''))throw Error('请求标识无效')
 return {deptId:id(dept),userId,gameSalesId,dayId:context.day.id,revision:context.revision,salesAmount:values.salesAmount,rebate:values.rebate,commission:values.commission,reason,requestKey:key}
}
async function create(session,body){const result=await call(session,'create',body,true);if(!result||result.status!=='CREATED'||!result.auditId||!/^[1-9]\d*$/.test(String(result.recordId))){const e=Error('保存结果未确认');e.mayHaveWritten=true;throw e}return result}
module.exports={options,command,create}
