import { test, expect } from 'vitest'
import { employeeReport } from './employee-report'
const scope = { deptId: '9007199254740993', actorId: '9007199254740995', start: '2026-11-05', end: '2026-11-06' }
function fixture() { return { ...scope, freshDays: 1, pendingDays: 1, personal: { electronic: '0.10', sportsBetting: '0.20' }, days: [{businessDate: scope.start, status: 'FRESH', personal: { electronic: '0.10', sportsBetting: '0.20' }}, { businessDate: scope.end, status: 'OPEN' }] } }
test('个人只合计已核对日期，保持长 ID 和小数精度', () => {
 const result = employeeReport(fixture(), scope)
 expect(result).toMatchObject({ electronic: '0.10', sports: '0.20', fresh: 1, pending: 1 })
 expect(result.rows[1]).toMatchObject({ status: '营业中', electronic: '—' })
})
test('拒绝其他账号、其他门店、重复日期和不一致汇总', () => {
 for (const patch of [{actorId:'9007199254740996'}, {deptId:'2'}, {personal:{electronic:'0.11',sportsBetting:'0.20'}}, {days:[fixture().days[0],fixture().days[0]]}]) expect(() => employeeReport({...fixture(),...patch},scope)).toThrow()
})
test('没有已核对日期时显示未知而非零销量', () => {
 const data = {...fixture(),freshDays:0,pendingDays:2,personal:null,days:fixture().days.map(d=>({...d,status:'NOT_OPEN'}))}
 expect(employeeReport(data,scope).electronic).toBe('—')
})
