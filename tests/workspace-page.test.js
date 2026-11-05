const assert = require('node:assert/strict')
const Module = require('node:module')
const { sameSession } = require('../utils/request')
const storage = new Map(), calls = [], navigations = []
const session = { tenantId: '1', accessToken: 'access-a', sessionKey: 'account-a' }
let info, mobile, identityError, mobileError, delayedIdentity, logoutDeferred, modal
global.wx = {
  getStorageSync: key => storage.get(key),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: key => storage.delete(key),
  navigateTo: value => navigations.push(value.url),
  reLaunch: value => navigations.push(value.url),
  showModal: value => { modal = value }
}
const original = Module._load
Module._load = function (name, parent, ...args) {
  if (parent && parent.filename.endsWith('/utils/workspace-page.js')) {
    if (name === './request') return { sameSession, request: async path => { calls.push(path); if (path === '/system/auth/logout') return logoutDeferred || true; if (mobileError) throw mobileError; return mobile } }
    if (name === './boss/api') return { identity: async () => { if (delayedIdentity) await delayedIdentity; if (identityError) throw identityError; return info }, capabilities: async () => ({ reportsEnabled: true }) }
  }
  return original.call(this, name, parent, ...args)
}
const { createWorkspacePage } = require('../utils/workspace-page')
Module._load = original
function reset() {
  storage.clear(); storage.set('yc_session', session); calls.length = 0; navigations.length = 0
  info = { user: { nickname: 'Employee' }, roles: [], permissions: [] }
  mobile = { user: { id: '9007199254740993' }, depts: [{ id: '9007199254740995', name: 'Store A' }, { id: '9007199254740997', name: 'Store B' }] }
  identityError = mobileError = delayedIdentity = logoutDeferred = modal = null
}
function page(kind) {
  const value = createWorkspacePage(kind)
  value.data = { ...value.data }
  value.setData = patch => Object.assign(value.data, patch)
  value.session = storage.get('yc_session')
  return value
}
async function run() {
  reset()
  const ledger = page('ledger'); await ledger.load()
  assert.deepEqual(ledger.data.items.map(item => item.key), ['employee-orders', 'reserve'])
  ledger.open({ currentTarget: { dataset: { key: 'employee-orders' } } })
  assert.ok(navigations[0].includes('deptId=9007199254740995&userId=9007199254740993'))
  ledger.department({ detail: { value: '1' } })
  ledger.open({ currentTarget: { dataset: { key: 'reserve' } } })
  assert.ok(navigations[1].includes('deptId=9007199254740997'))
  assert.equal(storage.get('yc_dept_1_9007199254740993'), '9007199254740997')
  ledger.open({ currentTarget: { dataset: { key: 'boss-funds' } } })
  assert.equal(navigations.length, 2)
  assert.ok(calls.every(path => path === '/system/auth/get-mobile-permission-info'))

  reset(); info.permissions = ['sport:check-fund:query']
  const boss = page('ledger'); await boss.load()
  assert.ok(boss.data.items.some(item => item.key === 'boss-funds'))
  assert.ok(!boss.data.items.some(item => item.key === 'boss-costs'))
  assert.ok(!boss.data.items.some(item => /pay|sms|mail|social/.test(item.key)))

  reset(); info.permissions = ['sport:check-service:query']
  const reports = page('reports'); await reports.load()
  assert.deepEqual(reports.data.items.map(item => item.key), ['personal-report', 'boss-reports'])
  reset(); mobileError = Error('no mobile scope')
  const noScope = page('ledger'); await noScope.load()
  assert.equal(noScope.data.items.length, 0)
  assert.ok(noScope.data.notice)

  reset(); identityError = Error('permission denied')
  const denied = page('ledger'); await denied.load()
  assert.equal(denied.data.items.length, 0)
  assert.equal(denied.data.error, 'permission denied')

  for (const change of ['unload', 'hide', 'account']) {
    reset(); let release
    delayedIdentity = new Promise(resolve => { release = resolve })
    const stale = page('ledger'), pending = stale.load()
    if (change === 'unload') stale.onUnload()
    else if (change === 'hide') stale.onHide()
    else storage.set('yc_session', { ...session, sessionKey: 'another-account' })
    const snapshot = JSON.stringify(stale.data)
    release(); await pending
    assert.equal(JSON.stringify(stale.data), snapshot)
    stale.open({ currentTarget: { dataset: { key: 'employee-orders' } } })
    assert.equal(navigations.length, 0)
  }
  reset(); storage.clear()
  const anonymous = page('mine'); await anonymous.load()
  assert.equal(anonymous.data.signedIn, false)
  assert.equal(calls.length, 0)
  reset()
  const hiddenLogout = page('mine'), cancelled = hiddenLogout.logout()
  hiddenLogout.onHide(); modal.success({ confirm: true }); await cancelled
  assert.equal(calls.length, 0)
  assert.equal(storage.get('yc_session'), session)

  reset(); let finishLogout
  logoutDeferred = new Promise(resolve => { finishLogout = resolve })
  const changed = page('mine'), submitting = changed.logout()
  modal.success({ confirm: true }); await Promise.resolve()
  const nextAccount = { ...session, sessionKey: 'next-account' }
  storage.set('yc_session', nextAccount); finishLogout(true); await submitting
  assert.equal(storage.get('yc_session'), nextAccount)
  assert.equal(navigations.length, 0)

  reset()
  const leaving = page('mine'), leavingPromise = leaving.logout()
  modal.success({ confirm: true }); await leavingPromise
  assert.equal(storage.has('yc_session'), false)
  assert.deepEqual(navigations, ['/pages/login/index'])
  console.log('Workspace tabs preserve scoped IDs, permission-filtered links, store preference and stale-session protection')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
