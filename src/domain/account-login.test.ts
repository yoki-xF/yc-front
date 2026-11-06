import { expect, test } from 'vitest'
import { accountLoginSession, identityId } from './account-login'

const response = { tenantId: '9007199254740993', tenantName: '服务端组织', accessToken: 'access', refreshToken: 'refresh' }
test('兼容旧身份响应的小整数编号，拒绝已失精度的数值，长ID必须为字符串', () => {
  expect(identityId(185)).toBe('185')
  expect(identityId('9007199254740993')).toBe('9007199254740993')
  for (const invalid of [9007199254740993, 0, -1, 1.2, '', '0', null]) expect(() => identityId(invalid)).toThrow()
})
test('组织直接来自认证响应，长组织ID不经过浮点转换', () => {
  expect(accountLoginSession(response, 'session-key')).toEqual({ ...response, key: 'session-key' })
})
test('拒绝缺失组织、令牌及不精确ID，不产生部分登录会话', () => {
  for (const invalid of [null, {}, { ...response, tenantId: Number(response.tenantId) }, { ...response, tenantId: '0' }, { ...response, tenantName: '' }, { ...response, accessToken: '' }, { ...response, refreshToken: null }]) {
    expect(() => accountLoginSession(invalid, 'session-key')).toThrow('登录结果不完整')
  }
})
