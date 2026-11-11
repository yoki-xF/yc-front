// Only a known internal watch route may be restored after login.
export function liveReturn(value: unknown): string | undefined {
  return typeof value === 'string' && /^\/live\/watch\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(value) ? value : undefined
}
