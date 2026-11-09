import {ledgerId,revisionOf,decimal} from './order-ledger'
import {dayUuid,type CashScope} from './cash-ledger'
export type ActivityScope=CashScope
export interface ActivityLine {activityId:string;deptId:string;activityName:string;userId:string;salesAmount:string}
export interface ActivitySnapshot {revision:string;items:ActivityLine[]}
export function activityId(value:unknown):string {
 if(typeof value!=='string')throw Error('编号必须为精确字符串')
 return ledgerId(value)
}
export function activityAmount(value:unknown):string {
 const result=decimal(value)
 if(BigInt(result.replace('.',''))>999999999999n)throw Error('促销金额上限9999999999.99元')
 return result
}
export function activityStaff(raw:any):{value:string;label:string}[]{
 if(!Array.isArray(raw))throw Error('员工选项不完整')
 const people=raw.map(p=>{if(typeof p?.label!=='string'||!p.label.trim())throw Error('员工姓名无效');return {value:activityId(p.value),label:p.label}})
 if(new Set(people.map(p=>p.value)).size!==people.length)throw Error('员工编号重复')
 return people
}
export function activitySnapshot(raw:any,dept:string):ActivitySnapshot {
 activityId(dept);const revision=revisionOf(raw?.revision)
 if(!Array.isArray(raw?.items)||raw.items.length>100)throw Error('活动列表不完整')
 const items:ActivityLine[]=raw.items.map((r:any):ActivityLine=>{
  if(activityId(r?.deptId)!==dept||typeof r.activityName!=='string'||!r.activityName.trim())throw Error('活动门店或名称无效')
  return {deptId:dept,activityId:activityId(r.activityId),activityName:r.activityName,userId:r.userId==null?'':activityId(r.userId),salesAmount:r.salesAmount==null?'':activityAmount(r.salesAmount)}
 })
 if(new Set(items.map(i=>i.activityId)).size!==items.length)throw Error('活动编号重复')
 return {revision,items}
}
export function activityPayload(snapshot:ActivitySnapshot,lines:ActivityLine[],dept:string,staff:{value:string}[]){
 if(!snapshot.items.length||lines.length!==snapshot.items.length)throw Error('请选择1至100项完整活动')
 const expected=new Set(snapshot.items.map(i=>i.activityId)),seen=new Set<string>()
 const items=lines.map(i=>{
  const id=activityId(i.activityId),userId=activityId(i.userId)
  if(i.deptId!==dept||!expected.has(id)||seen.has(id)||!staff.some(p=>p.value===userId))throw Error('活动、门店或有效员工范围不符')
  seen.add(id)
  if(typeof i.salesAmount!=='string')throw Error('请输入精确金额')
  return {deptId:activityId(dept),activityId:id,userId,salesAmount:activityAmount(i.salesAmount)}
 })
 return {deptId:dept,revision:revisionOf(snapshot.revision),items}
}
export interface ActivityJournal {version:1;scope:ActivityScope;day:{id:string;date:string};payload:ReturnType<typeof activityPayload>}
export function activityJournalKey(scope:ActivityScope){return `yc-activity-pending-v1:${activityId(scope.tenantId)}:${activityId(scope.actorId)}:${activityId(scope.deptId)}`}
export function requireActivityDay(original:{id:string;date:string},current:{id:string;date:string}){
 if(!dayUuid(original.id)||!/^\d{4}-\d{2}-\d{2}$/.test(original.date)||!Number.isFinite(Date.parse(original.date))||new Date(original.date).toISOString().slice(0,10)!==original.date||original.id!==current.id||original.date!==current.date)throw Error('原营业日已结束或变化，禁止无原因改写')
}
export function activityJournal(scope:ActivityScope,day:{id:string;date:string},payload:ReturnType<typeof activityPayload>):ActivityJournal {
 activityJournalKey(scope);requireActivityDay(day,day)
 const snapshot=activitySnapshot({revision:payload.revision,items:payload.items.map(i=>({...i,activityName:i.activityId}))},scope.deptId)
 const checked=activityPayload(snapshot,snapshot.items,scope.deptId,payload.items.map(i=>({value:i.userId})))
 if(JSON.stringify(checked)!==JSON.stringify(payload))throw Error('原请求格式不完整')
 return JSON.parse(JSON.stringify({version:1,scope,day,payload}))
}
export function readActivityJournal(text:string|null,scope:ActivityScope):ActivityJournal|null {
 if(text===null)return null
 const raw=JSON.parse(text)
 if(raw?.version!==1||raw.scope?.tenantId!==scope.tenantId||raw.scope?.actorId!==scope.actorId||raw.scope?.deptId!==scope.deptId)throw Error('原请求范围不符，禁止新写入')
 return activityJournal(scope,raw.day,raw.payload)
}
export function compareActivity(journal:ActivityJournal,snapshot:ActivitySnapshot,day:{id:string;date:string}):string {
 requireActivityDay(journal.day,day)
 const canonical=(items:{activityId:string;userId:string;salesAmount:string}[])=>JSON.stringify([...items].sort((a,b)=>a.activityId.localeCompare(b.activityId)).map(i=>[i.activityId,i.userId,i.salesAmount]))
 return canonical(journal.payload.items)===canonical(snapshot.items)?'服务器数值与原请求一致，但不能据此证明该请求成功；原日志继续保留，请联系管理员核对。':'服务器数值与原请求不同；原日志继续保留，禁止盲目重试，请联系管理员核对。'
}
