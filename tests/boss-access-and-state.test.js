const assert = require('node:assert/strict')
const Module = require('node:module')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const { query, recordView, can } = require('../utils/boss/resources')
let session = { tenantId: 1, accessToken: 'a', refreshToken: 'r' }
let calls = [], permissions = ['sport:check-fund:query'], deferRead
global.wx = { getStorageSync: () => session }
const sameSession = (a,b) => a && b && a.tenantId === b.tenantId && a.refreshToken === b.refreshToken
const originalLoad = Module._load
Module._load = function (name, parent, isMain) {
  if (name === '../request') return { sameSession, request: async (url, options) => {
    calls.push({ url, options })
    if (url.endsWith('get-permission-info')) return { user: { id: 1 }, permissions }
    if (deferRead) return new Promise(resolve => { deferRead.resolve = resolve })
    return { list: [{ id: 2, xj: '0.00', deptName: 'A' }], total: 1 }
  } }
  return originalLoad.call(this, name, parent, isMain)
}
const api = require('../utils/boss/api')
Module._load = originalLoad
async function run() {
  // 不能借另一个资源的权限访问；失败时不能打列表接口。
  await assert.rejects(api.list(session, 'users', {}, 1), /没有此功能权限/)
  assert.equal(calls.some(x => x.url.endsWith('/system/user/page')), false)
  const result = await api.list(session, 'funds', { start: '2026-11-01', end: '2026-11-02' }, 1)
  assert.equal(result.rows[0].fields.find(x => x.key === 'xj').value, '0.00')
  const read = calls.find(x => x.url.endsWith('/sport/boss/records/funds/page'))
  assert.equal(read.options.header['tenant-id'], '1')
  assert.equal(read.options.data['checkTime[1]'], '2026-11-02 23:59:59')
  assert.throws(() => query('funds', { start: '2026-02-30', end: '2026-03-01' }, 1), /有效/)
  assert.throws(() => query('__proto__', {}, 1), /不支持/)
  assert.equal(recordView('funds', { id: null, xj: null }).canOpen, false)
  assert.equal(recordView('commission', { id: 2 }).canOpen, true)
  assert.equal(can([], 'sport:check-fund:query'), false)
  // 页面已发出的请求，在切换账号后不得把数据交还调用页面。
  const originalSession = session
  deferRead = {}
  const pending = api.list(originalSession, 'funds', {}, 1)
  await new Promise(resolve => setImmediate(resolve))
  session = { tenantId: 2, accessToken: 'b', refreshToken: 'r2' }
  deferRead.resolve({ list: [{ id: 9, deptName: 'OLD' }], total: 1 })
  await assert.rejects(pending, /账号已变化/)
  // 分页失败后可以重试；翻页沿用已提交筛选，不混入尚未点击查询的条件。
  let definition, resolveList, fail = false, snapshots = []
  const context = { Page: value => { definition = value }, wx: { getStorageSync: () => session, setNavigationBarTitle() {} }, require: name => name.endsWith('/api') ? { list: async (_s,_key,filters,page) => { snapshots.push({ filters: {...filters}, page }); if (fail) throw Error('offline'); return new Promise(resolve => { resolveList = resolve }) } } : require('../utils/boss/resources') }
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../pages/boss/records/index.js'), 'utf8'), context)
  const page = { ...definition, data: structuredClone(definition.data), version: 0, session, type: 'funds', setData(update) { Object.assign(this.data, update) } }
  page.data.start = '2026-11-01'; page.data.end = '2026-11-02'
  const first = page.load(true); resolveList({ rows: [{ key: 'one' }], total: 2 }); await first
  page.data.start = '2020-01-01'
  const next = page.load(false); resolveList({ rows: [{ key: 'two' }], total: 2 }); await next
  assert.equal(snapshots[1].filters.start, '2026-11-01')
  assert.equal(page.data.rows.length, 2)
  fail = true; await page.load(true)
  assert.equal(page.data.loading, false); assert.equal(page.data.loaded, false); assert.equal(page.data.rows.length, 0)
  console.log('权限拒绝、租户头、空值/日期、迟到响应、分页及失败恢复检查通过')
}
run().catch(e => { console.error(e); process.exitCode = 1 })
