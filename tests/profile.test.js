const realSession=require('../utils/request').sameSession
const assert = require('node:assert/strict')
const Module = require('node:module')
let definition, resolveRequest
let session = { tenantId: 1, accessToken: 'a', tenantName: '甲' }
global.wx = { getStorageSync: () => session }
global.Page = value => { definition = value }
const original = Module._load
Module._load = function (name, ...args) {
  if (name === '../../utils/request') return { sameSession:realSession, request: () => new Promise(resolve => { resolveRequest = resolve }) }
  return original.call(this, name, ...args)
}
require('../pages/profile/index')
Module._load = original
const page = Object.assign({}, definition, { data: { ...definition.data }, setData(value) { Object.assign(this.data, value) } })
async function run() {
  page.onShow()
  resolveRequest({ id: 1, mobile: '13812345678' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.phone, '138****5678')
  page.onShow()
  session = { tenantId: 2, accessToken: 'b' }
  resolveRequest({ id: 1, mobile: '13812345678' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.profile, null)
  page.onShow()
  page.onHide()
  resolveRequest({ id: 2, mobile: '123' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(page.data.profile, null)
  console.log('个人资料遮罩、切换账号和离页迟到响应检查通过')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
