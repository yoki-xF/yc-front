import { cents, money, days } from './reporting.js'
export function employeeReport(raw: any, scope: { deptId: string; actorId: string; start: string; end: string }) {
  const range = days(scope.start, scope.end)
  if (!raw || raw.deptId !== scope.deptId || raw.actorId !== scope.actorId || raw.start !== scope.start || raw.end !== scope.end || !Array.isArray(raw.days) || raw.days.length !== range.length) throw Error('员工报表范围不一致，请重新读取')
  const seen = new Set<string>(); let electronic = 0, sports = 0, fresh = 0
  const rows = raw.days.map((row: any) => {
    if (!range.includes(row.businessDate) || seen.has(row.businessDate) || !['FRESH','OPEN','STALE','NOT_OPEN'].includes(row.status)) throw Error('营业日数据缺失或重复')
    seen.add(row.businessDate)
    if (row.status !== 'FRESH') return { date: row.businessDate, status: {OPEN:'营业中',STALE:'待核对',NOT_OPEN:'未营业'}[row.status as 'OPEN'|'STALE'|'NOT_OPEN'], electronic: '—', sports: '—' }
    const e = cents(row.personal?.electronic), s = cents(row.personal?.sportsBetting)
    electronic += e; sports += s; fresh++
    if (!Number.isSafeInteger(electronic) || !Number.isSafeInteger(sports)) throw Error('汇总金额超出可核对范围')
    return { date: row.businessDate, status: '已核对', electronic: money(e), sports: money(s) }
  }).sort((a: any,b: any) => a.date.localeCompare(b.date))
  if (raw.freshDays !== fresh || raw.pendingDays !== range.length - fresh || (fresh ? cents(raw.personal?.electronic) !== electronic || cents(raw.personal?.sportsBetting) !== sports : raw.personal !== null)) throw Error('个人销量与营业日明细不一致')
  return { rows, fresh, pending: range.length - fresh, electronic: fresh ? money(electronic) : '—', sports: fresh ? money(sports) : '—' }
}
