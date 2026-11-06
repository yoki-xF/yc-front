import type { Session } from '../api/session'

export function identityId(value: unknown): string {
  if (typeof value === 'number' && Number.isSafeInteger(value) && value > 0) return String(value)
  if (typeof value === 'string' && /^[1-9]\d*$/.test(value)) return value
  throw Error('账号身份数据不完整，请重新登录')
}

// Organization identity must come from the authenticated server response.
export function accountLoginSession(value: unknown, key: string): Session {
  const result = value as Record<string, unknown> | null
  if (!result || typeof result.tenantId !== 'string' || !/^[1-9]\d*$/.test(result.tenantId)
    || typeof result.tenantName !== 'string' || !result.tenantName.trim()
    || typeof result.accessToken !== 'string' || !result.accessToken
    || typeof result.refreshToken !== 'string' || !result.refreshToken || !key) {
    throw Error('登录结果不完整，请重新登录')
  }
  return { tenantId: result.tenantId, tenantName: result.tenantName, accessToken: result.accessToken, refreshToken: result.refreshToken, key }
}
