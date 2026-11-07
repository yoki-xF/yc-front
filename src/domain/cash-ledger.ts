import { ledgerId } from './order-ledger'
export interface CashScope { tenantId:string; actorId:string; deptId:string }
export interface CashJournal extends CashScope {
 version:1; createdAt:string; operatingDay:string; businessDate:string; requestKey:string
 transfer:{deptId:string;shiftAmount:string;shiftSource:0;remark:string}
}
export const dayUuid=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value)
function date(value:unknown):value is string {return typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value).toISOString().slice(0,10)===value}
export function cashAmount(value:unknown):string {
 if(typeof value!=='string'||!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value))throw Error('转入金额须大于0，最多两位小数，上限9999999999.99元')
 const [whole,fraction='']=value.split('.'), cents=BigInt(whole!)*100n+BigInt(fraction.padEnd(2,'0'))
 if(cents<=0n||cents>999999999999n)throw Error('转入金额超出有效范围')
 return `${whole}.${fraction.padEnd(2,'0')}`
}
export function cashKey(scope:CashScope){return `yc-cash-pending-v1:${ledgerId(scope.tenantId)}:${ledgerId(scope.actorId)}:${ledgerId(scope.deptId)}`}
export function cashCommand(scope:CashScope,day:{id:string;date:string},amount:string,remark:string,key:string,createdAt=new Date().toISOString()):CashJournal {
 cashKey(scope)
 if(!dayUuid(day.id)||!date(day.date))throw Error('营业日无效，请重新读取')
 if(typeof key!=='string'||!/^[A-Za-z0-9_-]{16,80}$/.test(key))throw Error('请求编号无效')
 if(typeof createdAt!=='string'||!Number.isFinite(Date.parse(createdAt)))throw Error('请求时间无效')
 if(typeof remark!=='string'||remark.length>300)throw Error('备注最多300字')
 return {version:1,...scope,createdAt,operatingDay:day.id,businessDate:day.date,requestKey:key,transfer:{deptId:scope.deptId,shiftAmount:cashAmount(amount),shiftSource:0,remark}}
}
export function readCashJournal(text:string|null,scope:CashScope):CashJournal|null {
 if(text===null)return null
 const value=JSON.parse(text)
 if(!value||value.version!==1||value.tenantId!==scope.tenantId||value.actorId!==scope.actorId||value.deptId!==scope.deptId||value.transfer?.deptId!==scope.deptId||value.transfer?.shiftSource!==0)throw Error('待核对请求范围不一致，请联系管理员；禁止生成新请求')
 const checked=cashCommand(scope,{id:value.operatingDay,date:value.businessDate},value.transfer.shiftAmount,value.transfer.remark,value.requestKey,value.createdAt)
 if(checked.transfer.shiftAmount!==value.transfer.shiftAmount)throw Error('待核对请求金额格式变化，请保留原请求核对')
 return checked
}
export function cashPayload(journal:CashJournal){return {requestKey:journal.requestKey,transfer:{...journal.transfer}}}
export function cashOutcome(raw:any,journal:CashJournal):'APPLIED'|'NOT_FOUND' {
 if(!raw||raw.deptId!==journal.deptId||raw.requestKey!==journal.requestKey||!['APPLIED','NOT_FOUND'].includes(raw.status))throw Error('请求结果不完整或范围不符，请保留原请求核对')
 return raw.status
}
export function requireCashDay(journal:CashJournal,day:{id:string;date:string}){if(journal.operatingDay!==day.id||journal.businessDate!==day.date)throw Error('原请求所属营业日已结束或变化，请查询原请求结果，禁止换新请求重复记账')}
export interface CashRow { id:string; deptId:string; userName:string; price:string; source:number|null; remark:string; createTime:string|null; businessDate:string|null }
export function cashPage(raw:any,dept:string):{list:CashRow[];total:number} {
 const total=typeof raw?.total==='string'&&/^\d+$/.test(raw.total)?Number(raw.total):raw?.total
 if(!Array.isArray(raw?.list)||raw.list.length>50||!Number.isSafeInteger(total)||total<0)throw Error('资金流水分页数据无效')
 const list=raw.list.map((row:any):CashRow=>{
  if(ledgerId(row.deptId)!==dept||typeof row.price!=='string'||!/^(-?)(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(row.price))throw Error('资金流水范围或金额无效')
  if(row.businessDate!=null&&!date(row.businessDate))throw Error('流水营业日期无效')
  if(row.createTime!=null&&typeof row.createTime!=='string')throw Error('流水创建日期无效')
  return {id:ledgerId(row.id),deptId:dept,userName:String(row.userName||'历史经办人待核对'),price:row.price,source:row.source==null?null:Number(row.source),remark:String(row.remark??''),createTime:row.createTime??null,businessDate:row.businessDate??null}
 })
 if(new Set(list.map((row:CashRow)=>row.id)).size!==list.length)throw Error('资金流水编号重复')
 return {list,total}
}

export function cashJournalKey(journal:CashJournal){return cashKey(journal)+':'+journal.requestKey}
export function cashJournals(entries:[string,string|null][],scope:CashScope):CashJournal[]{
 const prefix=cashKey(scope)+':'
 const result=entries.filter(([key])=>key.startsWith(prefix)).map(([key,value])=>{const j=readCashJournal(value,scope);if(!j||key!==cashJournalKey(j))throw Error('待核对请求编号不一致，禁止重复提交');return j})
 return result.sort((a,b)=>a.createdAt.localeCompare(b.createdAt)||a.requestKey.localeCompare(b.requestKey))
}
