const assert = require('node:assert/strict')
const Module = require('node:module')
let definition, response, modal, writes, reads, updates, toasts
const session = { tenantId: 1, accessToken: 'a', refreshToken: 'r' }
const storage = { yc_session: session }
const row = { revision: 'v1', record: { id: 1, xj: '1', wxBalance: '2', hsk: '3', zfb: '4', szRmb: '5' } }
const tick = () => new Promise(resolve => setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
global.wx = {
  getStorageSync: key => storage[key],
  setStorageSync: (key, value) => { storage[key] = structuredClone(value) },
  removeStorageSync: key => { delete storage[key] },
  showModal: options => { modal = options },
  showToast: () => { toasts++ }
}
global.Page = value => { definition = value }
const original = Module._load
Module._load = function (name, ...args) {
  if (name === '../../utils/operating-day') return require('./operating-day-fixture')
  if (name === '../../utils/request') return {
    sameSession: (a, b) => !!(a && b && a.tenantId === b.tenantId && a.refreshToken === b.refreshToken),
    request: async (url, options) => {
      assert.equal(options.header['X-Operating-Day'], 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
      if (options.method === 'POST') writes++
      else reads++
      return response()
    }
  }
  return original.call(this, name, ...args)
}
try { require('../pages/fund/index') } finally { Module._load = original }
async function fresh() {
  for (const key of Object.keys(storage)) delete storage[key]
  storage.yc_session = session
  writes = reads = updates = toasts = 0
  response = () => row
  const page = Object.assign({}, definition, {
    data: structuredClone(definition.data),
    setData(patch) { updates++; Object.assign(this.data, patch) }
  })
  page.onLoad({ deptId: '1', userId: '1' })
  await tick()
  page.saveDraft()
  return page
}
const invalidate = {
  unload: page => page.onUnload(),
  account: () => { storage.yc_session = { ...session, refreshToken: 'other' } },
  department: page => { page.deptId = '2' },
  user: page => { page.userId = '2' }
}
async function run() {
  for (const [reason, stale] of Object.entries(invalidate)) {
    // Every delayed modal must recheck ownership before writes or draft changes.
    for (const action of ['submit', 'reloadLatest', 'confirmChecked']) {
      const page = await fresh()
      page.data.uncertain = action === 'confirmChecked'
      const pending = page[action]()
      const callback = modal
      const draft = structuredClone(storage[page.draftKey])
      stale(page)
      const before = updates
      callback.success({ confirm: true })
      await pending
      await tick()
      page.input({ currentTarget: { dataset: { field: 'xj' } }, detail: { value: '99' } })
      page.saveDraft()
      await page.submit()
      await page.load()
      assert.equal(writes, 0, reason + ': ' + action)
      assert.equal(updates, before, reason + ': stale page update')
      assert.deepEqual(storage[page.draftKey], draft, reason + ': draft changed')
    }
    // Invalidation during bind's async boundary must prevent the next GET.
    const binding = await fresh()
    const loading = binding.load()
    stale(binding)
    const beforeBind = updates
    await loading
    assert.equal(reads, 1, reason + ': request after stale bind')
    assert.equal(updates, beforeBind)

    // Both successful and failed reads/writes must leave a stale page alone.
    for (const operation of ['load', 'submit']) {
      for (const fails of [false, true]) {
        const page = await fresh()
        const flight = deferred()
        response = () => flight.promise
        const pending = page[operation]()
        if (operation === 'submit') modal.success({ confirm: true })
        await tick()
        const draft = structuredClone(storage[page.draftKey])
        stale(page)
        const before = updates
        if (fails) flight.reject(Error('timeout'))
        else flight.resolve(row)
        await pending
        assert.equal(updates, before, reason + ': async ' + operation)
        assert.deepEqual(storage[page.draftKey], draft)
        assert.equal(toasts, 0)
        assert.equal(writes, operation === 'submit' ? 1 : 0)
        assert.equal(reads, operation === 'load' ? 2 : 1, 'no stale reload')
      }
    }
  }
  const page = await fresh()
  const day = page.operatingDay
  const pending = page.submit()
  modal.success({ confirm: true })
  await pending
  assert.equal(writes, 1)
  assert.equal(reads, 2)
  assert.equal(toasts, 1)
  assert.equal(storage[page.draftKey], undefined)
  assert.equal(page.operatingDay, day, 'successful refresh keeps the bound day')
  assert.equal(page.data.busy, false)
  assert.equal(page.data.xj, '1')
  console.log('Fund lifecycle guards and successful flow passed')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
