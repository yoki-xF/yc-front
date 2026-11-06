import { beforeEach, expect, test, vi } from 'vitest'
const state = vi.hoisted(() => ({ current: true, request: vi.fn() }))
vi.mock('./client', () => ({ request: state.request }))
vi.mock('./session', () => ({ session: { value: { key: 'login' } }, isCurrent: () => state.current }))
import { loadAccount, identity, departments, employeeScopeError, allowed, clearAccount } from './account'
beforeEach(() => { state.current = true; state.request.mockReset(); clearAccount() })
test('employee scope failure does not block authenticated manager queries or broaden employee scope', async () => {
  state.request.mockResolvedValueOnce({ user: { id: '1', username: 'boss' }, permissions: ['sport:check-fund:query'] }).mockRejectedValueOnce(Error('员工部门不可用'))
  await loadAccount()
  expect(allowed('sport:check-fund:query')).toBe(true)
  expect(departments.value).toEqual([]); expect(employeeScopeError.value).not.toBe('')
  expect(state.request).toHaveBeenCalledTimes(2)
})
test('identity failure remains fatal and grants no permissions', async () => {
  state.request.mockRejectedValueOnce(Error('没有登录'))
  await expect(loadAccount()).rejects.toThrow('没有登录')
  expect(identity.value).toBeNull(); expect(allowed('sport:check-fund:query')).toBe(false)
})
test('available employee departments retain long IDs', async () => {
  state.request.mockResolvedValueOnce({ user: { id: '1' }, permissions: [] }).mockResolvedValueOnce({ depts: [{ id: '9007199254740995', name: '员工门店' }] })
  await loadAccount()
  expect(departments.value[0]?.id).toBe('9007199254740995'); expect(employeeScopeError.value).toBe('')
})
test('account switch while scope is pending cannot populate the new account', async () => {
  state.request.mockResolvedValueOnce({ user: { id: '1' }, permissions: [] }).mockImplementationOnce(async () => { state.current = false; throw Error('账号已变化') })
  await expect(loadAccount()).rejects.toThrow('账号已变化')
  expect(departments.value).toEqual([]); expect(employeeScopeError.value).toBe('')
})
