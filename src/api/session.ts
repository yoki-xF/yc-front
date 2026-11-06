import { shallowRef } from 'vue'
export interface Session { tenantId: string; tenantName: string; accessToken: string; refreshToken: string; key: string }
const storageKey = 'yc_h5_session_v1'
function restore(): Session | null {
  try { const s = JSON.parse(sessionStorage.getItem(storageKey) || 'null'); return s && typeof s.key === 'string' && s.key && typeof s.accessToken === 'string' && /^\d+$/.test(String(s.tenantId)) ? s : null } catch { return null }
}
export const session = shallowRef<Session | null>(restore())
export function saveSession(value: Session | null) {
  if (value) sessionStorage.setItem(storageKey, JSON.stringify(value)); else sessionStorage.removeItem(storageKey)
  session.value = value
}
export function isCurrent(key: string) { return session.value?.key === key }
