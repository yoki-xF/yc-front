const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm')
const source = fs.readFileSync(require.resolve('../pages/boss/records/index.js'), 'utf8')
const flush = () => new Promise(resolve => setImmediate(resolve))
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b }); return { promise, resolve, reject } }
function setup() {
  const original = { tenantId: '1', accessToken: 'a', refreshToken: 'r' }
  let session = original, page, nextOptions, exportResult, optionsCalls = 0, listCalls = [], removed = [], navigations = []
  const api = {
    async options() { optionsCalls++; return nextOptions ? nextOptions() : [{ id: '9007199254740995', name: '甲店' }] },
    async identity() { return { permissions: ['sport:check-game-sales:create'] } },
    async list(_session, type, filters, pageNo) { listCalls.push({ filters: { ...filters }, pageNo }); return { rows: [{ key: String(pageNo), id: '9007199254740997', canOpen: true }], total: 2, canExport: true, canCreate: true } }
  }
  vm.runInNewContext(source, { Page(value) { page = value }, wx: { getStorageSync: () => session, setNavigationBarTitle() {}, navigateTo: value => navigations.push(value.url), switchTab() {}, shareFileMessage: value => navigations.push(value.filePath) }, require(name) {
    if (name.endsWith('/api')) return api
    if (name.endsWith('/export')) return { unlink: path => { if (path) removed.push(path) }, download: () => exportResult.promise }
    if (name.endsWith('/request')) return { sameSession: (a, b) => !!a && a === b }
    return require('../utils/boss/resources')
  } })
  page.data = structuredClone(page.data); page.setData = patch => Object.assign(page.data, patch)
  page.version = 0; page.session = original; page.type = 'funds'
  return { page, api, listCalls, removed, navigations, optionsCalls: () => optionsCalls, options: callback => { nextOptions = callback }, export: value => { exportResult = value }, switchAccount: () => { session = { ...original } } }
}
;(async () => {
  const retry = setup()
  retry.options(async () => { throw Error('门店读取失败') })
  await retry.page.init(); assert.equal(retry.page.data.ready, false); assert.equal(retry.listCalls.length, 0)
  retry.options(null); retry.page.search(); await flush()
  assert.equal(retry.optionsCalls(), 2); assert.equal(retry.page.data.loaded, true)
  retry.page.department({ detail: { value: '1' } }); retry.page.search(); await flush()
  assert.equal(retry.listCalls.at(-1).filters.deptId, '9007199254740995')
  retry.page.input({ detail: { value: '草稿条件' } }); retry.page.more(); await flush()
  assert.equal(retry.listCalls.at(-1).filters.keyword, '')
  assert.equal(retry.page.data.filtersDirty, true)
  retry.page.clear(); await flush()
  assert.equal(retry.page.data.deptIndex, 0); assert.equal(retry.page.data.filtersDirty, false)

  const hidden = setup(), optionWait = deferred()
  hidden.options(() => optionWait.promise)
  const waiting = hidden.page.init(); hidden.page.onHide(); optionWait.resolve([{ id: '1', name: '旧门店' }]); await waiting
  assert.equal(hidden.listCalls.length, 0); assert.equal(hidden.page.data.ready, false)
  hidden.options(null); hidden.page.opened = true; hidden.page.onShow(); await flush()
  assert.equal(hidden.page.data.loaded, true)

  const file = deferred(); hidden.export(file)
  const exporting = hidden.page.exportCsv(); hidden.page.onHide(); file.resolve('/private/old-result.csv'); await exporting
  assert(hidden.removed.includes('/private/old-result.csv')); assert.equal(hidden.page.data.hasExport, false)
  hidden.page.shareCsv(); assert.equal(hidden.navigations.length, 0)

  const changed = setup(), read = deferred()
  changed.api.list = () => read.promise
  const loading = changed.page.init(); await flush(); changed.switchAccount()
  read.resolve({ rows: [{ key: 'private' }], total: 1, canExport: true, canCreate: true }); await loading
  assert.equal(changed.page.data.rows.length, 0); assert.equal(changed.page.data.invalidEntry, true)
  assert.equal(changed.page.data.canExport, false); assert.equal(changed.page.data.loading, false)
  changed.page.create(); changed.page.commissionCreate(); assert.equal(changed.navigations.length, 0)
  console.log('经营记录门店重试、已提交筛选、范围重置、隐藏恢复、导出清理和账号切换保护通过')
})().catch(error => { console.error(error); process.exitCode = 1 })
