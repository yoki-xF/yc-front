import assert from 'node:assert/strict'
import { test } from 'vitest'
import * as r from './reporting.js'
test('营业日报表保留精确金额、结店完整性、长ID和排名规则', () => {
const filters={start:'2026-11-01',end:'2026-11-02'}
const day=(date,amount='0.10')=>({businessDate:date,status:'FRESH',closed:true,ruleVersion:r.RULE,instantSales:amount,electronicSales:'0.20',sportsBettingSales:'0.30',totalSales:(Number(amount)+0.5).toFixed(2),variance:'-0.01',wrongTicket:'9.99'})
const store=(id,days)=>({deptId:id,deptName:'Store '+id,days})
const raw=stores=>({schemaVersion:2,...filters,stores})
assert.deepEqual(r.period('week','2026-11-01'),{start:'2026-10-26',end:'2026-11-01'})
assert.deepEqual(r.period('month','2024-02-29'),{start:'2024-02-01',end:'2024-02-29'})
assert.deepEqual(r.period('month','2026-12-31'),{start:'2026-12-01',end:'2026-12-31'})
assert.throws(()=>r.days('2026-02-29','2026-03-01'),/日期/)
assert.throws(()=>r.days('2025-01-01','2026-11-02'),/范围/)
const incomplete=store('9007199254740993',[day('2026-11-01'),{businessDate:'2026-11-02',status:'STALE'}])
let result=r.normalize(raw([store('1',[day('2026-11-01'),day('2026-11-02')]),incomplete]),filters)
assert.equal(result.summary.totalSales,'1.80');assert.equal(result.summary.variance,'-0.03');assert.equal(result.summary.wrongTicket,'29.97');assert.equal(result.summary.pendingDays,1)
assert.equal(result.rows[1].deptId,'9007199254740993');assert.equal(result.rows[1].sales,'待核对');assert.equal(result.rows[1].knownSales,'0.60');assert.equal(result.ranked.length,1)
result=r.normalize(raw([store('1',[day('2026-11-01'),day('2026-11-02')]),store('2',[day('2026-11-01'),day('2026-11-02')]),store('3',[day('2026-11-01','0.00'),day('2026-11-02','0.00')])]),filters)
assert.deepEqual(result.ranked.map(s=>s.rank),[1,1,3])
assert.throws(()=>r.normalize(raw([store('1',[day('2026-11-01'),day('2026-11-01')])]),filters),/重复/)
assert.throws(()=>r.normalize(raw([store('1',[day('2026-11-01')])]),filters),/不完整/)
assert.throws(()=>r.normalize(raw([store('1',[day('2026-11-01'),{...day('2026-11-02'),closed:false}])]),filters),/结店/)
assert.throws(()=>r.normalize(raw([store('1',[day('2026-11-01'),{...day('2026-11-02'),totalSales:'1.00'}])]),filters),/不一致/)
assert.throws(()=>r.normalize({rows:[],completedSales:'0'},filters),/接口/)
assert.throws(()=>r.normalize(raw([store('2',[day('2026-11-01'),day('2026-11-02')])]),{...filters,deptId:'1'}),/所选门店/)
const off=r.normalize(raw([store('1',[{businessDate:'2026-11-01',status:'NOT_OPEN'},{businessDate:'2026-11-02',status:'NOT_OPEN'}])]),filters);assert.equal(off.ranked.length,0)
assert.throws(()=>r.cents('90071992547409.92'),/范围/);assert.equal(r.money(r.cents('90071992547409.91')),'90071992547409.91')

})

test('日报 CSV 使用页面核对合计，待核对金额留空，门店名不会成为公式', () => {
  const filters = { start: '2026-11-01', end: '2026-11-02' }
  const report = r.normalize({
    schemaVersion: 2, ...filters, stores: [{
      deptId: '1', deptName: '=门店,"甲"', days: [
        { businessDate: filters.start, status: 'FRESH', closed: true, ruleVersion: r.RULE, totalSales: '6.00',
          instantSales: '1.00', electronicSales: '2.00', sportsBettingSales: '3.00', variance: '-0.01', wrongTicket: '0.00' },
        { businessDate: filters.end, status: 'STALE' },
      ],
    }],
  }, filters)
  const csv = r.reportCsv(report, filters.start + ' 至 ' + filters.end)
  assert.match(csv, /"已核对合计","6.00","1.00","2.00","3.00","-0.01","0.00"/)
  assert.ok(csv.includes(`"'=门店,""甲"""`))
  assert.match(csv, /"需重新生成","","","","","",""\r\n/)
})
