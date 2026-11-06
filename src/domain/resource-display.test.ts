import { expect, test } from 'vitest'
import { recordView } from './resources.js'
test('business dates do not expose ISO midnight and amounts keep original precision', () => {
  const row = recordView('funds',{id:'9007199254740995',checkTime:'2026-11-05T00:00',xj:'123456789012.01'})
  expect(row.fields.find((f:any) => f.key === 'checkTime')?.value).toBe('2026-11-05')
  expect(row.fields.find((f:any) => f.key === 'xj')?.value).toBe('123456789012.01')
  expect(row.id).toBe('9007199254740995')
})
test('missing dates remain missing and creation times keep time of day', () => {
  const row = recordView('users',{id:'1',createTime:'2026-11-05T12:34:56'})
  expect(row.fields.find((f:any) => f.key === 'createTime')?.value).toBe('2026-11-05 12:34')
  const missing = recordView('funds',{id:'1',checkTime:null})
  expect(missing.fields.find((f:any) => f.key === 'checkTime')?.value).toBe('—')
})
