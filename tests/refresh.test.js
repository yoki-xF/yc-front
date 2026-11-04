const assert = require('node:assert/strict')
let session = { tenantId: 1, accessToken: 'old', refreshToken: 'refresh' }
let refreshCalls = 0, postCalls = 0, holdRefresh = null, mode = 'normal'
global.wx = {
  getStorageSync: () => ({ ...session }), setStorageSync: (_, value) => { session = value },
  request(options) {
    if (options.url.endsWith('/system/auth/refresh-token')) {
      refreshCalls++
      if (mode === 'hold') { holdRefresh = options; return }
      if (mode === 'expired') return setImmediate(() => options.success({ statusCode: 200, data: { code: 400, msg: '无效的刷新令牌' } }))
      if (mode === 'offline') return setImmediate(() => options.fail())
      return setImmediate(() => options.success({ statusCode: 200, data: { code: 0, data: { accessToken: 'new', refreshToken: 'refresh' } } }))
    }
    if (options.method === 'POST') { postCalls++; return setImmediate(() => options.success({ statusCode: 200, data: { code: 401 } })) }
    setImmediate(() => options.success({ statusCode: 200, data: options.header.Authorization === 'Bearer new' ? { code: 0, data: 'ok' } : { code: 401 } }))
  }
}
const { request } = require('../utils/request')
const headers = () => ({ Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) })
async function run() {
  const h = headers()
  assert.deepEqual(await Promise.all([request('/one', { header: h }), request('/two', { header: h })]), ['ok', 'ok'])
  assert.equal(refreshCalls, 1)
  assert.equal(session.accessToken, 'new')
  await assert.rejects(request('/write', { method: 'POST', header: headers() }), err => err.code === 401)
  assert.equal(postCalls, 1); assert.equal(refreshCalls, 1)
  session = { tenantId: 1, accessToken: 'old', refreshToken: 'r2' }; mode = 'hold'
  const pending = request('/three', { header: headers() })
  await new Promise(resolve => setImmediate(resolve))
  session = { tenantId: 2, accessToken: 'other', refreshToken: 'other' }
  holdRefresh.success({ statusCode: 200, data: { code: 0, data: { accessToken: 'new', refreshToken: 'r2' } } })
  await assert.rejects(pending, /账号已切换/)
  assert.equal(session.accessToken, 'other')
  session = { tenantId: 1, accessToken: 'old', refreshToken: 'expired' }; mode = 'expired'
  await assert.rejects(request('/four', { header: headers() }), err => err.code === 401 && /重新登录/.test(err.message))
  assert.equal(session.refreshToken, 'expired')
  session = { tenantId: 1, accessToken: 'old', refreshToken: 'retryable' }; mode = 'offline'
  await assert.rejects(request('/five', { header: headers() }), /网络连接失败/)
  assert.equal(session.refreshToken, 'retryable')
  console.log('并发刷新、写操作不重放及账号切换检查通过')
}
run().catch(err => { console.error(err); process.exitCode = 1 })
