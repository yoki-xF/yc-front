import { cents, days, money, RULE } from './reporting.js'
export type Day = { deptId: string; businessDate: string; status: 'NOT_OPEN'|'OPEN'|'CLOSED'; id?: string; revision?: string }
export function operatingDay(raw: any, deptId: string): Day {
  if (!raw || raw.deptId !== deptId || !['NOT_OPEN','OPEN','CLOSED'].includes(raw.status)) throw Error('营业日返回范围或状态无效')
  days(raw.businessDate, raw.businessDate)
  if (raw.status !== 'NOT_OPEN' && (typeof raw.id !== 'string' || !/^[a-f0-9-]{36}$/.test(raw.id) || !/^[1-9]\d*$/.test(String(raw.revision)) || !Number.isSafeInteger(Number(raw.revision)))) throw Error('营业日版本信息不完整')
  return { deptId, businessDate: raw.businessDate, status: raw.status, id: raw.id, revision: raw.revision }
}
const keys = ['openingFunds','closingFunds','reserveIn','instantSales','electronicSales','sportsBettingSales','totalSales','adjustments','wrongTicket','variance'] as const
export function closingPreview(raw: any, day: Day) {
  if (!raw || raw.status !== 'READY_TO_CLOSE' || raw.id !== day.id || raw.deptId !== day.deptId || String(raw.revision) !== String(day.revision) || raw.businessDate !== day.businessDate || !/^[a-f0-9]{64}$/.test(raw.sourceRevision) || raw.report?.ruleVersion !== RULE) throw Error('结店预览已变化，请重新读取营业日')
  const report = Object.fromEntries(keys.map(key => [key, money(cents(raw.report[key]))]))
  const total = cents(report.instantSales) + cents(report.electronicSales) + cents(report.sportsBettingSales)
  if (!Number.isSafeInteger(total) || total !== cents(report.totalSales)) throw Error('结店预览销量合计不一致')
  const fundKeys = ['xj','wxBalance','hsk','zfb','szRmb']
  if (!Array.isArray(raw.funds) || raw.funds.length !== 5 || new Set(raw.funds.map((f: any) => f.key)).size !== 5 || raw.funds.some((f: any) => !fundKeys.includes(f.key))) throw Error('五类资金明细不完整')
  const funds = raw.funds.map((f: any) => ({ key: f.key, opening: money(cents(f.opening)), closing: money(cents(f.closing)) }))
  return { sourceRevision: raw.sourceRevision as string, report, funds: funds as {key: string; opening: string; closing: string}[] }
}
export type DayCommand = { action: 'open'|'close'; data: { deptId: string; requestKey: string; dayId?: string; revision?: number; sourceRevision?: string } }
export function commandStorageKey(login: string, deptId: string) { return `yc-day-command:${login}:${deptId}` }
export function readDayCommand(value: string | null, deptId: string): DayCommand | null {
  if (!value) return null
  const command = JSON.parse(value)
  if (!['open','close'].includes(command?.action) || command.data?.deptId !== deptId || !/^[a-zA-Z0-9-]{16,80}$/.test(command.data?.requestKey)) throw Error('待核对请求记录无效，请联系管理员核对营业日')
  if (command.action === 'close' && (!/^[a-f0-9-]{36}$/.test(command.data.dayId) || !Number.isSafeInteger(command.data.revision) || command.data.revision < 1 || !/^[a-f0-9]{64}$/.test(command.data.sourceRevision))) throw Error('待核对结店请求不完整')
  return command
}
