import assert from 'node:assert/strict'
import {test} from 'vitest'
import {period} from './report-period.js'
test('保留业务规则：report-period.test',()=>{
assert.deepEqual(period('week',new Date(2026,10,1)),{start:'2026-10-26',end:'2026-11-01'})
assert.deepEqual(period('month',new Date(2026,1,12)),{start:'2026-02-01',end:'2026-02-28'})
assert.deepEqual(period('day',new Date(2026,10,4)),{start:'2026-11-04',end:'2026-11-04'})
})
