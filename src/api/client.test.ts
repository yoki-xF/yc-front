import { beforeEach, expect, test, vi } from 'vitest'
const memory = new Map<string, string>()
beforeEach(() => {
  vi.resetModules(); memory.clear()
  vi.stubGlobal('sessionStorage', { getItem: (key: string) => memory.get(key) || null, setItem: (key: string, value: string) => memory.set(key, value), removeItem: (key: string) => memory.delete(key) })
  vi.stubGlobal('window', { location: { origin: 'https://test.example' } })
})
const response = (data: unknown, code = 0) => ({ ok: true, status: 200, json: async () => ({ code, data }) })
async function setup() {
  const store = await import('./session')
  store.saveSession({ key: 'first', tenantId: '9007199254740993', tenantName: '组织', accessToken: 'old', refreshToken: 'refresh' })
  const client = await import('./client')
  return { ...store, ...client }
}
test('tenant, token, long ID and query encoding stay intact', async () => {
  const { request } = await setup()
  const fetch = vi.fn(async () => response({ id: '9007199254740995' })); vi.stubGlobal('fetch', fetch)
  expect(await request('/record', { data: { id: '9007199254740995', name: 'A&B' } })).toEqual({ id: '9007199254740995' })
  const [url, options] = fetch.mock.calls[0] as unknown as [URL, RequestInit]
  expect(url.searchParams.get('name')).toBe('A&B')
  expect(options.headers).toMatchObject({ Authorization: 'Bearer old', 'tenant-id': '9007199254740993' })
})
test('an account change rejects a late response', async () => {
  const { request, saveSession } = await setup()
  let finish!: (value: any) => void
  vi.stubGlobal('fetch', () => new Promise(resolve => { finish = resolve }))
  const pending = request('/private')
  saveSession({ key: 'second', tenantId: '2', tenantName: '另一组织', accessToken: 'new', refreshToken: 'new' })
  finish(response({ secret: 'old' }))
  await expect(pending).rejects.toThrow('账号已变化')
})
test('concurrent expired GETs share one refresh and use the rotated token', async () => {
  const { request } = await setup()
  let refreshes = 0
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    if (String(url).includes('refresh-token')) { refreshes++; await new Promise(resolve => setTimeout(resolve, 5)); return response({ accessToken: 'rotated', refreshToken: 'rotated-r' }) }
    return options.headers.Authorization === 'Bearer old' ? response(null, 401) : response('ok')
  }))
  expect(await Promise.all([request('/a'), request('/b')])).toEqual(['ok', 'ok'])
  expect(refreshes).toBe(1)
})
test('write requests are never replayed on authentication failure', async () => {
  const { request, session } = await setup()
  const fetch = vi.fn(async () => response(null, 401)); vi.stubGlobal('fetch', fetch)
  await expect(request('/write', { method: 'POST', data: { amount: '1.00' } })).rejects.toThrow('登录已过期')
  expect(fetch).toHaveBeenCalledTimes(1); expect(session.value).toBe(null)
})
test('public login requests do not inherit the previous account token', async () => {
  const { request } = await setup()
  const fetch = vi.fn(async () => response('ok')); vi.stubGlobal('fetch', fetch)
  await request('/login', { method: 'POST', public: true, tenantId: '2' })
  const options = fetch.mock.calls[0]?.[1] as any
  expect(options.headers.Authorization).toBeUndefined(); expect(options.headers['tenant-id']).toBe('2')
})
test('employee write carries the reviewed operating day and is not replayed on timeout', async()=>{
 const {request}=await setup(), fetch=vi.fn(async()=>{throw Error('timeout')});vi.stubGlobal('fetch',fetch)
 await expect(request('/sport/wx/night/count/fund/safe-submit',{method:'POST',operatingDay:'01928a10-aabb-4abc-9abc-abcdef123456',data:{deptId:'9007199254740993'}})).rejects.toThrow('提交操作请先核对结果')
 expect(fetch).toHaveBeenCalledTimes(1)
 expect((fetch.mock.calls[0] as unknown as [URL,RequestInit])[1].headers).toMatchObject({'X-Operating-Day':'01928a10-aabb-4abc-9abc-abcdef123456'})
})
test('private voucher upload uses authenticated multipart data, not JSON or public URLs',async()=>{
 const {request}=await setup();const fetch=vi.fn(async()=>response('pv:'+'a'.repeat(32)));vi.stubGlobal('fetch',fetch)
 await request('/sport/wx/night/count/service/voucher',{method:'POST',data:{deptId:'9007199254740993'},file:new File(['fixture'],'test.png',{type:'image/png'})})
 const [,options]=fetch.mock.calls[0] as unknown as [URL,RequestInit]
 expect(options.headers).toMatchObject({Authorization:'Bearer old','tenant-id':'9007199254740993'});expect(options.headers).not.toHaveProperty('content-type');expect((options.body as FormData).get('deptId')).toBe('9007199254740993')
})
test('private voucher preview returns an image blob and checks the active account',async()=>{
 const {request}=await setup();vi.stubGlobal('fetch',vi.fn(async()=>new Response(new Blob(['fixture'],{type:'image/png'}),{headers:{'content-type':'image/png','cache-control':'private, no-store'}})))
 expect((await request<Blob>('/sport/wx/night/count/service/voucher',{data:{deptId:'1',ref:'pv:'+'a'.repeat(32)},responseType:'blob'})).type).toBe('image/png')
})
