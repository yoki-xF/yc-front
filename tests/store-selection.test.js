const realSession=require('../utils/request').sameSession
const assert = require('node:assert/strict')
const Module = require('node:module')
let definition, resolveRequest
const storage = { yc_session: { tenantId: 1, accessToken: 'a' }, yc_dept_1_9: 22 }
global.wx = { getStorageSync: key => storage[key], setStorageSync: (key, value) => { storage[key] = value }, removeStorageSync: key => { delete storage[key] } }
global.Page = value => { definition = value }
const originalLoad = Module._load
Module._load = function (name, ...rest) {
  if (name === '../../utils/request') return { sameSession:realSession, request: () => new Promise(resolve => { resolveRequest = resolve }) }
  return originalLoad.call(this, name, ...rest)
}
require('../pages/index/index')
Module._load = originalLoad
const page = Object.assign({}, definition, { data: { ...definition.data }, setData(update) { Object.assign(this.data, update) } })
async function run() {
  page.onShow()
  resolveRequest({ user: { id: 9 }, depts: [{ id: 11, name: '一店' }, { id: 22, name: '二店' }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.deptIndex, 1)
  page.changeDept({ detail: { value: '0' } })
  assert.equal(storage.yc_dept_1_9, 11)
  page.onShow()
  resolveRequest({ user: { id: 9 }, depts: [{ id: 22, name: '二店' }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.deptIndex, 0)
  assert.equal(storage.yc_dept_1_9, 22)
  page.onShow()
  storage.yc_session = { tenantId: 2, accessToken: 'b' }
  resolveRequest({ user: { id: 9 }, depts: [{ id: 11, name: '一店' }] })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.user, null)
  assert.equal(storage.yc_dept_2_9, undefined)
  console.log('门店选择、撤权后的选择修正和跨账号迟到响应检查通过')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
