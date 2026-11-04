const { apiBase } = require('./config')
let refreshFlight = null
// Short-lived in-memory lineage lets an already-open form use a rotated token from the same login.
// A new login gets a different sessionKey, even for the same tenant/account.
const tokenLineage = new Map()
let activeEpoch = null
function newSessionKey() { return 'login_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2) + '_' + Math.random().toString(36).slice(2) }

function sameSession(a, b) {
  if (!a || !b || String(a.tenantId) !== String(b.tenantId)) return false
  if (a.sessionKey || b.sessionKey) return typeof a.sessionKey === 'string' && !!a.sessionKey && a.sessionKey === b.sessionKey
  return !!(a.refreshToken && b.refreshToken ? a.refreshToken === b.refreshToken : a.accessToken === b.accessToken)
}
function error(message, code) { const result = new Error(message); result.code = code; return result }
function send(path, options = {}) {
  if (!apiBase) return Promise.reject(error('请先配置测试服务地址'))
  return new Promise((resolve, reject) => {
    wx.request({
      url: apiBase.replace(/\/$/, '') + path,
      method: options.method || 'GET', data: options.data, timeout: options.timeout || 15000,
      header: Object.assign({ 'content-type': 'application/json' }, options.header || {}),
      success(res) {
        const body = res.data
        if (res.statusCode === 401 || (body && body.code === 401)) return reject(error('登录已过期，请重新登录', 401))
        if (res.statusCode < 200 || res.statusCode >= 300) return reject(error('服务请求失败，请稍后重试', res.statusCode))
        if (!body || body.code !== 0) return reject(error((body && body.msg) || '服务返回异常', body && body.code))
        resolve(body.data)
      },
      fail() { reject(error('网络连接失败，请检查网络后重试')) }
    })
  })
}
async function refresh(session) {
  const active = wx.getStorageSync('yc_session')
  if (!sameSession(active, session)) throw error('账号已切换，请重新操作')
  if (active.accessToken !== session.accessToken) return active
  if (!session.refreshToken) throw error('登录已过期，请重新登录', 401)
  if (!refreshFlight || !sameSession(refreshFlight.session, session)) {
    const flight = { session }
    flight.promise = send('/system/auth/refresh-token', {
      method: 'POST', data: { refreshToken: session.refreshToken },
      header: { 'content-type': 'application/x-www-form-urlencoded', 'tenant-id': String(session.tenantId) }
    }).then(result => {
      const latest = wx.getStorageSync('yc_session')
      if (!sameSession(latest, session)) throw error('账号已切换，请重新操作')
      if (!result || !result.accessToken || !result.refreshToken) throw error('登录已过期，请重新登录', 401)
      const updated = Object.assign({}, latest, { accessToken: result.accessToken, refreshToken: result.refreshToken })
      if (latest.sessionKey) {
        tokenLineage.set(session.accessToken, { sessionKey: latest.sessionKey, tenantId: String(latest.tenantId) })
        while (tokenLineage.size > 8) tokenLineage.delete(tokenLineage.keys().next().value)
      }
      wx.setStorageSync('yc_session', updated)
      return updated
    }).catch(err => {
      if (err.code === 400 || err.code === 401) throw error('登录已过期，请重新登录', 401)
      throw err
    }).finally(() => { if (refreshFlight === flight) refreshFlight = null })
    refreshFlight = flight
  }
  return refreshFlight.promise
}
async function request(path, options = {}) {
  const session = wx.getStorageSync('yc_session')
  if (activeEpoch !== (session && session.sessionKey)) { tokenLineage.clear(); activeEpoch = session && session.sessionKey }
  let header = options.header || {}
  let token = (header.Authorization || '').replace(/^Bearer\s+/i, '')
  const previous = tokenLineage.get(token)
  if (session && session.sessionKey && previous && previous.sessionKey === session.sessionKey && previous.tenantId === String(session.tenantId) && String(header['tenant-id']) === String(session.tenantId)) {
    header = Object.assign({}, header, { Authorization: 'Bearer ' + session.accessToken })
    options = Object.assign({}, options, { header }); token = session.accessToken
  }
  const authenticated = session && token === session.accessToken && String(header['tenant-id']) === String(session.tenantId)
  if (token && !authenticated) throw error('账号已切换，请重新操作')
  try { const result = await send(path, options); if (authenticated && !sameSession(session, wx.getStorageSync('yc_session'))) throw error('账号已切换，请重新操作'); return result }
  catch (err) {
    if (err.code !== 401 || !authenticated || (options.method || 'GET').toUpperCase() !== 'GET') throw err
    const updated = await refresh(session)
    const result = await send(path, Object.assign({}, options, { header: Object.assign({}, header, { Authorization: 'Bearer ' + updated.accessToken }) }))
    if (!sameSession(session, wx.getStorageSync('yc_session'))) throw error('账号已切换，请重新操作')
    return result
  }
}
module.exports = { request, sameSession, newSessionKey }
