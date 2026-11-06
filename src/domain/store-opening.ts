import { catalogId } from './catalog-form'
export const fundLabels = { xj: '现金', wxBalance: '微信余额', hsk: '汇收款', zfb: '支付宝', szRmb: '数字人民币' } as const
export type FundKey = keyof typeof fundLabels
export const fundKeys = Object.keys(fundLabels) as FundKey[]
export type Funds = Record<FundKey, string>
export interface Material { id: string; materialName: string; brandName: string; money: string; price: string; num: string; revision: string }
export interface OpeningLine { materialId: string; packageNum: string; sheetNum: string; revision: string }
export interface OpeningCommand { deptId: string; requestKey: string; reason: string; funds: Funds; lines: OpeningLine[] }
export interface OpeningOptions { departments: { id: string; name: string }[]; materials: Material[] }
const revision = /^[a-f0-9]{64}$/
export function amount(value: unknown, max = 999999999999n): string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,17})(\.\d{1,2})?$/.test(value)) throw Error('金额必须明确填写，最多两位小数')
  const [whole, fraction = ''] = value.split('.')
  const cents = BigInt(whole!) * 100n + BigInt(fraction.padEnd(2, '0'))
  if (cents > max) throw Error('金额超出允许范围')
  return `${whole}.${fraction.padEnd(2, '0')}`
}
function cents(value: string) { return BigInt(value.replace('.', '')) }
export function totalFunds(funds: Funds) { const sum = fundKeys.reduce((n, k) => n + cents(amount(funds[k])), 0n); return `${sum / 100n}.${String(sum % 100n).padStart(2, '0')}` }
export function quantity(value: unknown): string {
  if (typeof value !== 'string' || !/^(0|[1-9]\d{0,6})$/.test(value) || BigInt(value) > 1000000n) throw Error('包数和散张数须为0至1000000的整数')
  return value
}
export function openingOptions(raw: any): OpeningOptions {
  if (!Array.isArray(raw?.departments) || !Array.isArray(raw.materials) || raw.materials.length > 500) throw Error('初始化选项不完整')
  const departments = raw.departments.map((d: any) => { if (typeof d.name !== 'string') throw Error('门店名称缺失'); return { id: catalogId(d.id), name: d.name } })
  const materials = raw.materials.map((m: any): Material => {
    if (typeof m.materialName !== 'string' || typeof m.revision !== 'string' || !revision.test(m.revision)) throw Error('票种名称或版本缺失')
    return { id: catalogId(m.id), materialName: m.materialName, brandName: String(m.brandName ?? ''), money: amount(m.money, 99999999999999999999n), price: amount(m.price, 99999999999999999999n), num: String(m.num ?? ''), revision: m.revision }
  })
  if (new Set(departments.map((d: {id: string}) => d.id)).size !== departments.length || new Set(materials.map((m: Material) => m.id)).size !== materials.length) throw Error('门店或票种重复')
  return { departments, materials }
}
export function openingStatus(raw: any) {
  if (typeof raw?.initialized !== 'boolean' || typeof raw.canInitialize !== 'boolean' || typeof raw.reason !== 'string' || (raw.initialized && raw.canInitialize)) throw Error('初始化状态无效')
  return { initialized: raw.initialized as boolean, canInitialize: raw.canInitialize as boolean, reason: raw.reason as string }
}
export function openingCommand(deptId: string, reason: string, funds: Funds, lines: OpeningLine[], requestKey: string): OpeningCommand {
  catalogId(deptId)
  if (!/^[A-Za-z0-9-]{16,80}$/.test(requestKey)) throw Error('请求编号无效')
  if (typeof reason !== 'string' || reason.trim().length < 5 || reason.trim().length > 500) throw Error('请填写5至500字的启用说明')
  if (!funds || Object.keys(funds).sort().join() !== [...fundKeys].sort().join()) throw Error('须完整填写五类初始资金')
  const normalized = Object.fromEntries(fundKeys.map(k => [k, amount(funds[k])])) as Funds
  if (!Array.isArray(lines) || !lines.length || lines.length > 500) throw Error('须选择1至500个票种，数量可为零')
  const normalizedLines = lines.map(l => {
    if (!l || typeof l.revision !== 'string' || !revision.test(l.revision)) throw Error('票种版本无效')
    return { materialId: catalogId(l.materialId), revision: l.revision, packageNum: quantity(l.packageNum), sheetNum: quantity(l.sheetNum) }
  })
  if (new Set(normalizedLines.map(l => l.materialId)).size !== lines.length) throw Error('票种不能重复')
  return { deptId, requestKey, reason: reason.trim(), funds: normalized, lines: normalizedLines }
}
export function validateSelection(command: OpeningCommand, options: OpeningOptions) {
  if (!options.departments.some(d => d.id === command.deptId)) throw Error('门店不在当前管理范围')
  for (const line of command.lines) {
    const m = options.materials.find(m => m.id === line.materialId)
    if (!m || m.revision !== line.revision) throw Error('票种资料已变化，请核对；待确认请求仍须保留')
    if (cents(m.money) <= 0n || cents(m.price) <= 0n) throw Error('请先完善票种面值和单包价格')
  }
}
export function openingStorageKey(tenant: string, actor: string, dept: string) { return `yc-opening-v1:${catalogId(tenant)}:${catalogId(actor)}:${catalogId(dept)}` }
export function readOpeningCommand(text: string | null, dept: string): OpeningCommand | null {
  if (text === null) return null
  try {
    const raw = JSON.parse(text)
    const checked = openingCommand(raw.deptId, raw.reason, raw.funds, raw.lines, raw.requestKey)
    if (checked.deptId !== dept || JSON.stringify(raw) !== JSON.stringify(checked)) throw Error('mismatch')
    return checked
  } catch { throw Error('待确认请求损坏或范围不符，已禁止新提交；请联系管理员核对，勿清除记录') }
}

export function totalStock(command: OpeningCommand, options: OpeningOptions) {
  let total=0n
  for(const line of command.lines) {
    const material=options.materials.find(m=>m.id===line.materialId && m.revision===line.revision)
    if(!material)return '待服务器核对'
    total+=cents(material.price)*BigInt(quantity(line.packageNum))+cents(material.money)*BigInt(quantity(line.sheetNum))
  }
  return `${total/100n}.${String(total%100n).padStart(2,'0')}`
}
