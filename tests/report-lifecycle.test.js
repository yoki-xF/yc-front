const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../pages/report/index.js'), 'utf8')
const flush = () => new Promise(resolve => setImmediate(resolve))
function setup(session = { tenantId: '1', accessToken: 'test' }) {
  let page, requests = [], destination
  vm.runInNewContext(source, {
    Page(value) { page = value },
    wx: { getStorageSync: () => session, switchTab: options => { destination = options.url } },
    require(name) { return name.endsWith('/request') ? { sameSession: (a, b) => !!a && a === b, request: (path, options) => new Promise((resolve, reject) => requests.push({ options, resolve, reject })) } : { period: () => ({ start: '2026-11-05', end: '2026-11-05' }) } }
  })
  page.data = { ...page.data }; page.setData = patch => Object.assign(page.data, patch)
  return { page, requests, destination: () => destination }
}
;(async () => {
  for (const [session, deptId] of [[null, '1'], [{}, ''], [{}, 'bad'], [{}, '0']]) {
    const { page, requests, destination } = setup(session)
    page.onLoad({ deptId, deptName: '门店100%' }); page.retry()
    assert.equal(page.data.loading, false); assert.equal(page.data.invalidEntry, true)
    assert.equal(page.data.deptName, '门店100%'); assert.equal(requests.length, 0)
    page.backToWorkspace(); assert.equal(destination(), '/pages/index/index')
  }
  const { page, requests } = setup()
  page.onLoad({ deptId: '9007199254740995' })
  page.onHide(); requests[0].resolve({ deptId: '9007199254740995', start: '2026-11-05', end: '2026-11-05', days: [] }); await flush()
  assert.equal(page.data.report, null); assert.equal(page.data.loading, false)
  page.onShow(); assert.equal(requests.length, 2)
  requests[1].reject(Error('网络失败')); await flush()
  assert.equal(page.data.loading, false); assert.match(page.data.error, /网络失败/)
  assert.equal(page.data.invalidEntry, false)
  page.retry(); assert.equal(requests.length, 3)
  page.onUnload(); requests[2].reject(Error('离开后的失败')); await flush()
  assert.equal(page.data.error, '')
  console.log('员工报表无效入口、名称容错、隐藏恢复、失败重试和卸载响应保护通过')
})().catch(error => { console.error(error); process.exitCode = 1 })
