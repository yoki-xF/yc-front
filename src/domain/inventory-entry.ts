import { cents } from './reporting.js'
export type CountKind = 'morning'|'evening'
export type CountLine = { materialId:string; inventoryId:string|null; materialName:string; price:string; money:string; invPackageNum:string; invZhangNum:string }
function id(value: unknown) { if (typeof value==='number'&&!Number.isSafeInteger(value))throw Error('库存编号精度无效');const text=String(value);if(!/^[1-9]\d*$/.test(text))throw Error('库存或票种编号无效');return text }
function amount(value: unknown) { if(value==null || (typeof value!=='number' && typeof value!=='string'))throw Error('库存价格或资金缺失');const text=String(value);if(!/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(text))throw Error('库存价格或资金格式无效');return text }
function count(value: unknown,max: number) { const text=String(value);if(!/^(0|[1-9]\d{0,6})$/.test(text)||Number(text)>max)throw Error(`实盘数量须为0至${max}的整数`);return text }
function money(value: bigint) { const text=(value<0n?-value:value).toString().padStart(3,'0');return (value<0n?'-':'')+text.slice(0,-2)+'.'+text.slice(-2) }
export function countLines(saved: any[], stocks: any[], dept: string): CountLine[] {
 if(!Array.isArray(saved)||!Array.isArray(stocks))throw Error('库存明细缺失，请重新读取')
 const result=new Map<string,CountLine>(),seen=new Set<string>()
 for(const row of stocks){
  if(String(row.deptId)!==dept)throw Error('库存不属于所选门店')
  const key=id(row.materialId);if(result.has(key))throw Error('门店票种库存重复，请管理员核对')
  result.set(key,{materialId:key,inventoryId:id(row.id),materialName:String(row.materialName||'未命名票种'),price:amount(row.price),money:amount(row.money),invPackageNum:count(row.packageNum,1000000),invZhangNum:count(row.sheetNum,1000000)})
 }
 for(const row of saved){
  const key=id(row.materialId);if(seen.has(key))throw Error('盘点票种重复');seen.add(key)
  const current=result.get(key)
  if(current){current.invPackageNum=count(row.invPackageNum,1000000);current.invZhangNum=count(row.invZhangNum,1000000)}
  else result.set(key,{materialId:key,inventoryId:row.inventoryId&&String(row.inventoryId)!=='0'?id(row.inventoryId):null,materialName:String(row.materialName||'未命名票种'),price:amount(row.price),money:amount(row.money),invPackageNum:count(row.invPackageNum,1000000),invZhangNum:count(row.invZhangNum,1000000)})
 }
 if(result.size>100)throw Error('票种超过100项，请联系管理员分店核对')
 return [...result.values()]
}
export function countTotal(lines: CountLine[],kind: CountKind) {
 let value=0n,packages=0n,sheets=0n;const seen=new Set<string>()
 for(const line of lines){if(seen.has(line.materialId))throw Error('票种重复');seen.add(line.materialId);const p=BigInt(count(line.invPackageNum,kind==='morning'?999999:1000000)),s=BigInt(count(line.invZhangNum,kind==='morning'?999999:1000000));value+=BigInt(cents(amount(line.price)))*p+BigInt(cents(amount(line.money)))*s;packages+=p;sheets+=s}
 return {amount:money(value),packages:packages.toString(),sheets:sheets.toString(),cents:value}
}
export const morningMoneyFields=[{key:'morningCashDesc',source:'xj',label:'现金'},{key:'wxBalance',source:'wxBalance',label:'微信'},{key:'hsk',source:'hsk',label:'汇收款'},{key:'zfb',source:'zfb',label:'支付宝'},{key:'szRmb',source:'szRmb',label:'数字人民币'}]
export function morningAmounts(funds: any) {
 if(!funds||typeof funds.locked!=='boolean'||typeof funds.hidden!=='boolean'||typeof funds.started!=='boolean')throw Error('门店期初资金状态不完整')
 return Object.fromEntries(morningMoneyFields.map(f=>[f.key,amount(funds[f.source])]))
}
export function morningSummary(lines: CountLine[],stocks: any[],values: Record<string,string>,baseCash: unknown) {
 const total=countTotal(lines,'morning');let base=0n
 for(const row of stocks)base+=BigInt(cents(amount(row.price)))*BigInt(count(row.packageNum,1000000))+BigInt(cents(amount(row.money)))*BigInt(count(row.sheetNum,1000000))
 for(const field of morningMoneyFields)amount(values[field.key])
 return {invCount:total.amount,invYesterdayDiff:money(total.cents-base),invCashDiff:money(BigInt(cents(amount(values.morningCashDesc)))-BigInt(cents(amount(baseCash))))}
}
export function countPayload(lines: CountLine[],kind: CountKind,deptId:string) {
 countTotal(lines,kind)
 return lines.map(line=>({materialId:id(line.materialId),inventoryId:line.inventoryId,deptId,materialName:line.materialName,price:line.price,money:line.money,invPackageNum:Number(line.invPackageNum),invZhangNum:Number(line.invZhangNum)}))
}
