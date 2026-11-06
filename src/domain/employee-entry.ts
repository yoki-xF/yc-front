export type EntryKind = 'fund'|'business'
export type EntryField = { key: string; label: string; count?: boolean; optional?: boolean }
export const fundFields: EntryField[] = [
 {key:'xj',label:'现金余额'},{key:'wxBalance',label:'微信余额'},{key:'hsk',label:'汇收款余额'},{key:'zfb',label:'支付宝余额'},{key:'szRmb',label:'数字人民币余额'},
 {key:'wxBalanceCount',label:'微信笔数',count:true,optional:true},{key:'hskCount',label:'汇收款笔数',count:true,optional:true},{key:'zfbCount',label:'支付宝笔数',count:true,optional:true},{key:'szRmbCount',label:'数字人民币笔数',count:true,optional:true}
]
export const businessFields: EntryField[] = [
 {key:'dcSaleMoney',label:'电彩销量'},{key:'dcSaleNum',label:'电彩销售笔数',count:true},{key:'jcSaleMoney',label:'竞彩销量'},{key:'jcSaleNum',label:'竞彩销售笔数',count:true},
 {key:'dcConversionMoney',label:'电彩兑奖金额'},{key:'dcConversionNum',label:'电彩兑奖笔数',count:true},{key:'jkConversionMoney',label:'即开兑奖金额'},{key:'jkConversionNum',label:'即开兑奖笔数',count:true},
 {key:'ydPay',label:'移动支付记账金额'},{key:'outAmount',label:'支出金额'},{key:'yjMoney',label:'缴款金额'},{key:'giftTicket',label:'赠票金额'},{key:'redEnvelope',label:'红包金额'},{key:'discountTicket',label:'折扣金额'},{key:'commissionFee',label:'手续费'},{key:'wrongTicket',label:'错票金额（单列）'},{key:'jkOrderAmount',label:'即开下单金额'}
]
export function entryFields(kind: EntryKind) { return kind === 'fund' ? fundFields : businessFields }
export function entryValues(kind: EntryKind, record: any) {
 const values: Record<string,string> = {}
 for (const f of entryFields(kind)) {
  const value = record?.[f.key]
  if (typeof value === 'number' && (!Number.isSafeInteger(value) || !f.count)) throw Error('接口金额须以精确字符串返回')
  values[f.key] = value == null ? (kind === 'fund' ? '' : f.count ? '0' : '0.00') : String(value)
 }
 values.classes = record?.classes || ''
 return values
}
export function entryPayload(kind: EntryKind, values: Record<string,string>, shifts: {value:string}[], original: any) {
 const record: Record<string,unknown> = {}
 for (const f of entryFields(kind)) {
  const value = (values[f.key] || '').trim()
  if (f.optional && !value) continue
  if (f.count) {
   if (!/^(0|[1-9]\d{0,7})$/.test(value)) throw Error(f.label+'须为0至99999999的整数')
   record[f.key] = Number(value)
  } else {
   if (!/^-?(0|[1-9]\d{0,9})(\.\d{1,2})?$/.test(value)) throw Error(f.label+'须填写最多两位小数的金额，绝对值不超过9999999999.99')
   record[f.key] = value
  }
 }
 if (kind === 'business') {
  if (!shifts.some(s => s.value === values.classes)) throw Error('请选择启用班次')
  record.classes = values.classes
  // Preserve existing private voucher references without accepting arbitrary metadata from the form.
  if (original?.voucherPic != null) record.voucherPic = original.voucherPic
 }
 return record
}
export function employeeDay(raw: any, deptId: string, actorId: string) {
 if (!raw || raw.deptId !== deptId || raw.actorId !== actorId || raw.status !== 'OPEN' || typeof raw.id !== 'string' || !/^[0-9a-f-]{36}$/.test(raw.id) || !/^\d{4}-\d{2}-\d{2}$/.test(raw.businessDate)) throw Error('当前门店未开店或营业日已变化，请联系有权限人员确认开店')
 return {id:raw.id as string,date:raw.businessDate as string}
}
export function entrySnapshot(raw: any) {
 if (!raw || typeof raw.revision !== 'string' || !/^[a-f0-9]{64}$/.test(raw.revision) || (raw.record !== null && (typeof raw.record !== 'object' || Array.isArray(raw.record)))) throw Error('表单版本或记录不完整，请重新读取')
 return {revision:raw.revision as string,record:raw.record}
}
export function entryDraftKey(login: string, actor: string, dept: string, day: string, kind: EntryKind) { return `yc-entry:${login}:${actor}:${dept}:${day}:${kind}` }
