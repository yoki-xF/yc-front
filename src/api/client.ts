import { session, saveSession, isCurrent } from './session'
export class ApiError extends Error { constructor(message: string, public code?: number) { super(message) } }
const base = (import.meta.env.VITE_API_BASE || '/admin-api').replace(/\/$/, '')
let refreshFlight: { key: string; promise: Promise<void> } | null = null
interface Options { method?: string; data?: Record<string, unknown>; public?: boolean; tenantId?: string; signal?: AbortSignal; operatingDay?: string; file?: File; fileField?: string; responseType?: 'blob' | 'xlsx' | 'csv' }
async function send(path: string, options: Options, token?: string) {
  const url = new URL(base + path, window.location.origin)
  const method = options.method || 'GET'
  if (method === 'GET') for (const [key, value] of Object.entries(options.data || {})) if (value != null && value !== '') url.searchParams.set(key, String(value))
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (options.operatingDay) {
    if (!/^[a-f0-9-]{36}$/.test(options.operatingDay)) throw new ApiError('缺少有效营业日，请重新读取')
    headers['X-Operating-Day'] = options.operatingDay
  }
  if (options.file) delete headers['content-type']
  if (token) headers.Authorization = 'Bearer ' + token
  if (options.tenantId) headers['tenant-id'] = options.tenantId
  const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20000)
  const abort = () => controller.abort()
  options.signal?.addEventListener('abort', abort, { once: true })
  if (options.signal?.aborted) controller.abort()
  try {
    let payload: BodyInit | undefined = method === 'GET' ? undefined : JSON.stringify(options.data || {})
    if (options.file) {
      if (method === 'GET') throw new ApiError('文件上传需要提交请求')
      const form = new FormData(); form.append(options.fileField ?? 'file', options.file)
      for (const [key,value] of Object.entries(options.data || {})) if (value != null) form.append(key,String(value))
      payload = form
    }
    const response = await fetch(url, { method, headers, body: payload, signal: controller.signal, credentials: 'omit', cache: 'no-store' })
    if (options.responseType === 'blob' && response.ok && ['image/jpeg','image/png','image/webp'].includes(response.headers.get('content-type')?.split(';')[0] || '')) return await response.blob()
    if (options.responseType === 'xlsx' && response.ok &&
        response.headers.get('content-type')?.split(';')[0] === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet') return await response.blob()
    if (options.responseType === 'csv' && response.ok && response.headers.get('content-type')?.split(';')[0] === 'text/csv') return await response.blob()
    const body = await response.json().catch(() => null)
    if (response.status === 401 || body?.code === 401) throw new ApiError('登录已过期，请重新登录', 401)
    if (!response.ok || body?.code !== 0) throw new ApiError(body?.msg || '服务请求失败，请稍后重试', body?.code || response.status)
    if (options.responseType === 'csv') throw new ApiError('导出文件格式无效')
    if (options.responseType === 'xlsx') throw new ApiError('导入模板格式无效')
    if (options.responseType === 'blob') throw new ApiError('凭证格式无效或暂不可预览')
    return body.data
  } catch (error) {
    if (error instanceof ApiError) throw error
    if (options.signal?.aborted) throw new ApiError('请求已取消')
    throw new ApiError('网络连接失败或请求超时，请重试；提交操作请先核对结果')
  } finally { clearTimeout(timer); options.signal?.removeEventListener('abort', abort) }
}
async function refresh(key: string) {
  if (!isCurrent(key)) throw new ApiError('账号已变化')
  if (!refreshFlight || refreshFlight.key !== key) {
    const promise = (async () => {
      const s = session.value!
      if (!s.refreshToken) throw new ApiError('登录已过期', 401)
      const response = await fetch(base + '/system/auth/refresh-token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded', 'tenant-id': s.tenantId }, body: new URLSearchParams({ refreshToken: s.refreshToken }), signal: AbortSignal.timeout(20000), credentials: 'omit', cache: 'no-store' })
      const body = await response.json()
      if (!isCurrent(key)) throw new ApiError('账号已变化')
      if (!response.ok || body.code !== 0 || !body.data?.accessToken || !body.data?.refreshToken) throw new ApiError('登录已过期，请重新登录', 401)
      saveSession({ ...s, accessToken: body.data.accessToken, refreshToken: body.data.refreshToken })
    })().finally(() => { if (refreshFlight?.key === key) refreshFlight = null })
    refreshFlight = { key, promise }
  }
  return refreshFlight.promise
}
export async function request<T = any>(path: string, options: Options = {}): Promise<T> {
  const s = options.public ? null : session.value
  if (!options.public && !s) throw new ApiError('请先登录', 401)
  const args = { ...options, tenantId: options.tenantId || s?.tenantId }
  try {
    let result
    try { result = await send(path, args, s?.accessToken) }
    catch (error) {
      // Only read requests are replayed automatically; writes may already have reached the server.
      if (!(error instanceof ApiError) || error.code !== 401 || !s || (options.method && options.method !== 'GET')) throw error
      await refresh(s.key)
      result = await send(path, args, session.value!.accessToken)
    }
    if (s && !isCurrent(s.key)) throw new ApiError('账号已变化，请重新进入')
    return result
  } catch (error) {
    if (s && isCurrent(s.key) && error instanceof ApiError && error.code === 401) saveSession(null)
    throw error
  }
}
