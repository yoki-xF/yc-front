export type OrderType = 'purchase' | 'transfer'
export type Direction = 'in' | 'out'
export type Action = 'edit' | 'confirm' | 'cancel'
export function ledgerId(v: unknown): string {
 if (typeof v === 'number' && Number.isSafeInteger(v) && v > 0) return String(v)
 if (typeof v !== 'string' || !/^[1-9]\d*$/.test(v) || BigInt(v)>9223372036854775807n) throw Error('编号无效或精度不安全')
 return v
}
const maximum = 99999999999999999999n
export function decimal(v: unknown): string {
 // Numbers are accepted only in the conservative small-price range. Larger JSON numbers
 // may already have lost cents before reaching this module.
 if (typeof v === 'number') {
  if (!Number.isFinite(v) || v < 0 || v > 1000000000 || !/^\d+(\.\d{1,2})?$/.test(String(v))) throw Error('金额精度不安全，请联系管理员提供金额字符串')
  v = String(v)
 }
 if (typeof v !== 'string' || !/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(v)) throw Error('金额必须为非负且最多两位小数')
 const [a,b=''] = v.split('.'); const n=BigInt(a!)*100n+BigInt(b.padEnd(2,'0'))
 if(n>maximum)throw Error('金额超出上限')
 return `${a}.${b.padEnd(2,'0')}`
}
export function qty(v: unknown): number {
 const s=String(v)
 if(!/^(0|[1-9]\d{0,6})$/.test(s)||BigInt(s)>1000000n)throw Error('包数和张数须为0至1000000的整数')
 return Number(s)
}
export const revisionOf=(v: unknown):string=>{if(typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))throw Error('单据版本无效');return v}
function available(value:unknown):number {
 const text=String(value)
 if(!/^(0|[1-9]\d{0,9})$/.test(text)||BigInt(text)>2147483647n)throw Error('源库存数量无效')
 return Number(text)
}
export function requireEditorDay(original:string,current:string){if(!original||original!==current)throw Error('表单营业日已变化，请重新打开表单核对')}
export interface Choice { id:string; name:string; price:string; money:string; packageNum?:number; sheetNum?:number }
export interface Line { materialId:string; packageNum:string; sheetNum:string; expectedPrice:string; expectedMoney:string }
export function choices(raw: any, inventory=false): Choice[] {
 if(!Array.isArray(raw))throw Error('票种选项不完整')
 const result=raw.map(m=>({id:ledgerId(inventory?m.materialId:m.id),name:String(m.materialName||''),price:decimal(m.price),money:decimal(m.money),...(inventory?{packageNum:available(m.packageNum),sheetNum:available(m.sheetNum)}:{})}))
 if(new Set(result.map(m=>m.id)).size!==result.length)throw Error('票种重复，请联系管理员')
 return result
}
export function allowedActions(type:OrderType,direction:Direction,order:any):Action[]{
 if(String(order?.stat)!=='0'||(type==='transfer'&&!/^T[0-9a-f]{32}$/.test(order?.orderNo)))return []
 return type==='purchase'?['edit','confirm','cancel']:direction==='in'?['edit','cancel']:['confirm']
}
export function lineTotal(lines:Line[]) {
 let total=0n
 for(const l of lines)total+=BigInt(decimal(l.expectedPrice).replace('.',''))*BigInt(qty(l.packageNum))+BigInt(decimal(l.expectedMoney).replace('.',''))*BigInt(qty(l.sheetNum))
 if(total>maximum)throw Error('单据金额超出上限')
 return `${total/100n}.${String(total%100n).padStart(2,'0')}`
}
export function checkedLines(lines:Line[],options:Choice[]) {
 if(!lines.length||lines.length>100)throw Error('请选择1至100个票种')
 if(new Set(lines.map(l=>l.materialId)).size!==lines.length)throw Error('票种不能重复')
 const result=lines.map(l=>{
  const m=options.find(m=>m.id===ledgerId(l.materialId)); if(!m)throw Error('票种不在服务器选项中')
  const packageNum=qty(l.packageNum),sheetNum=qty(l.sheetNum)
  if(!packageNum&&!sheetNum)throw Error('每行至少填写一个正数量')
  if(decimal(l.expectedPrice)!==m.price||decimal(l.expectedMoney)!==m.money)throw Error('价格快照已变化，请重新选择票种并核对')
  if(m.packageNum!=null&&(packageNum>m.packageNum||sheetNum>m.sheetNum!))throw Error('源店库存不足')
  return {materialId:m.id,packageNum,sheetNum,expectedPrice:m.price,expectedMoney:m.money}
 });lineTotal(lines);return result
}
export interface Snapshot { order:any; items:any[]; revision:string; direction:Direction }
export function snapshot(raw:any,type:OrderType,dept:string,direction:Direction):Snapshot {
 if(!raw?.order||!Array.isArray(raw.items))throw Error('单据详情不完整')
 ledgerId(raw.order.id)
 const actual=type==='purchase'?'in':raw.direction
 if((type==='transfer'&&actual!==direction)||(actual==='out'?ledgerId(raw.order.exDeptId):ledgerId(raw.order.deptId))!==dept)throw Error('单据门店或方向不符')
 return {order:raw.order,items:raw.items,revision:revisionOf(raw.revision),direction:actual}
}
export function snapshotLines(s:Snapshot):Line[]{return s.items.map(i=>({materialId:ledgerId(i.materialId),packageNum:String(qty(i.packageNum)),sheetNum:String(qty(i.sheetNum)),expectedPrice:decimal(i.price),expectedMoney:decimal(i.money)}))}
export function validateOriginal(s:Snapshot) {
 const lines=snapshotLines(s); if(!lines.length||lines.length>100||new Set(lines.map(l=>l.materialId)).size!==lines.length)throw Error('历史明细异常，请联系管理员')
 if(lines.some(l=>!qty(l.packageNum)&&!qty(l.sheetNum))||s.items.some(i=>String(i.stat)!==String(s.order.stat)))throw Error('明细状态或数量异常')
 if(lineTotal(lines)!==decimal(s.order.totalAmount)||lines.reduce((n,l)=>n+qty(l.packageNum),0)!==Number(s.order.totalPackageNum)||lines.reduce((n,l)=>n+qty(l.sheetNum),0)!==Number(s.order.totalSheetNum))throw Error('单据汇总异常，请联系管理员')
 for(let n=0;n<lines.length;n++)if(decimal(s.items[n].orderAmount??s.items[n].totalAmount)!==lineTotal([lines[n]!]))throw Error('明细金额异常')
 return lines
}
export function journalKey(tenant:string,actor:string,dept:string,type:OrderType,order='create') {
 return `yc-order-unknown-v1:${ledgerId(tenant)}:${ledgerId(actor)}:${ledgerId(dept)}:${type}:${order==='create'?order:ledgerId(order)}`
}
export interface Journal { action:'create'|Action; day:string; revision?:string; payload:unknown; sentAt:string }
export function readJournal(text:string|null):Journal|null {
 if(text===null)return null
 const j=JSON.parse(text)
 if(!j||!['create','edit','confirm','cancel'].includes(j.action)||typeof j.day!=='string'||!/^([a-f0-9]{8}-)([a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(j.day)||!j.payload||typeof j.payload!=='object'||typeof j.sentAt!=='string'||!Number.isFinite(Date.parse(j.sentAt)))throw Error('结果未知记录损坏，禁止提交，请联系管理员核对')
 if(j.action!=='create')revisionOf(j.revision)
 return j
}
export function verified(j:Journal,s:Snapshot):boolean {
 if(j.action==='create')return false
 if(j.action==='confirm')return String(s.order.stat)==='1'
 if(j.action==='cancel')return String(s.order.stat)==='2'
 if(!j.revision||s.revision===j.revision||String(s.order.stat)!=='0')return false
 try {
  const p=j.payload as {items:Line[];remark?:string}
  const actual=snapshotLines(s)
  if(!Array.isArray(p.items)||p.items.length!==actual.length)return false
  return p.items.every(l=>actual.some(a=>a.materialId===l.materialId&&qty(a.packageNum)===qty(l.packageNum)&&qty(a.sheetNum)===qty(l.sheetNum)&&a.expectedPrice===decimal(l.expectedPrice)&&a.expectedMoney===decimal(l.expectedMoney)))&&String(s.order.remark??s.items[0]?.remark??'')===String(p.remark??'')
 }catch{return false}
}
export function transitionPath(type:OrderType,action:'confirm'|'cancel',dept:string,id:string,revision:string) {
 return `/sport/wx/order-ledger/${type}/${action}?`+new URLSearchParams({deptId:ledgerId(dept),id:ledgerId(id),revision:revisionOf(revision)})
}

export function writeResult(action:'create'|Action,result:unknown):string|null {
 if(action==='create')return ledgerId(result)
 if(result!==true)throw Error('单据回执不完整，请保留原请求并核对')
 return null
}

export function createdLabel(value:unknown):string {
 if(typeof value==='number'&&Number.isSafeInteger(value)){const d=new Date(value);if(Number.isFinite(d.getTime()))return d.toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})}
 if(typeof value==='string'&&/^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/.test(value))return value.replace('T',' ').slice(0,19)
 return '时间待核对'
}
