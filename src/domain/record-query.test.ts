import { beforeEach, expect, test } from 'vitest'
import { rememberRecordQuery, recallRecordQuery, clearRecordQueries, visibleDepartment } from './record-query'
beforeEach(clearRecordQueries)
const filters = { keyword: '门店A', start: '2026-11-05', end: '2026-11-05', deptId: '9007199254740995' }
test('detail return recalls submitted filters without retaining edited drafts', () => {
  rememberRecordQuery('login-a','funds',filters)
  const draft = recallRecordQuery('login-a','funds')!; draft.deptId = 'other'; draft.keyword = '未提交'
  expect(recallRecordQuery('login-a','funds')).toEqual(filters)
})
test('filters never cross login or resource boundaries and logout clears them', () => {
  rememberRecordQuery('login-a','funds',filters)
  expect(recallRecordQuery('login-b','funds')).toBeNull()
  expect(recallRecordQuery('login-a','users')).toBeNull()
  clearRecordQueries(); expect(recallRecordQuery('login-a','funds')).toBeNull()
})
test('revoked or deleted departments are reset without broadening the saved scope silently', () => {
  expect(visibleDepartment(filters.deptId,[{id:filters.deptId}])).toBe(filters.deptId)
  expect(visibleDepartment(filters.deptId,[{id:'2'}])).toBe('')
  expect(visibleDepartment('',[])).toBe('')
})
