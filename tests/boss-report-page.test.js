const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../pages/boss/reports/index.js'), 'utf8')
function setup(session, permission = true) {
  let page, calls = 0, resolveIdentity
  const api = {
    active(value) { if (!value || value !== session) throw Error('账号已变化') },
    identity() { calls++; return new Promise(resolve => { resolveIdentity = resolve }) },
    async options() { return [{ id: '1', name: '门店' }] }
  }
  vm.runInNewContext(source, { Page(value) { page = value }, wx: { getStorageSync() { return session }, navigateTo() {} }, require(name) {
    if (name.endsWith('/api')) return api
    if (name.endsWith('/resources')) return { can: () => permission }
    return { period: () => ({ start: '2026-11-05', end: '2026-11-05' }), days() {}, async read() { throw Error('查询网络失败') } }
  } })
  page.data = { ...page.data }
  page.setData = patch => Object.assign(page.data, patch)
  page.version = 0
  return { page, calls: () => calls, resolve: () => resolveIdentity({ permissions: [] }) }
}
;(async () => {
  const anonymous = setup(null)
  await anonymous.page.init()
  assert.equal(anonymous.calls(), 0)
  assert.equal(anonymous.page.data.loading, false)
  assert.equal(anonymous.page.data.ready, false)
  assert.match(anonymous.page.data.error, /登录/)
  const denied = setup({}, false), deniedInit = denied.page.init()
  denied.resolve(); await deniedInit
  assert.equal(denied.page.data.ready, false)
  assert.equal(denied.page.data.depts.length, 0)
  assert.match(denied.page.data.error, /没有报表权限/)
  const hidden = setup({}), hiddenInit = hidden.page.init()
  hidden.page.onHide(); hidden.resolve(); await hiddenInit
  assert.equal(hidden.page.data.ready, false)
  const network = setup({}), networkInit = network.page.init()
  network.resolve(); await networkInit
  assert.equal(network.page.data.ready, true)
  assert.equal(network.page.data.busy, false)
  assert.equal(network.page.data.report, null)
  assert.match(network.page.data.error, /查询网络失败/)
  console.log('报表未登录、无权限、隐藏后迟到响应和查询失败状态通过')
})().catch(error => { console.error(error); process.exitCode = 1 })
