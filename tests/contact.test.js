const realSession=require('../utils/request').sameSession
const assert = require('node:assert/strict')
const Module = require('node:module')
let definition, resolveRequest, call, toast
let session = { tenantId: 1, accessToken: 'a' }
global.wx = {
  getStorageSync: () => session,
  makePhoneCall: opts => { call = opts.phoneNumber },
  showToast: opts => { toast = opts.title }
}
global.Page = value => { definition = value }
const original = Module._load
Module._load = function (name, ...args) {
  if (name === '../../utils/request') return { sameSession:realSession, request: () => new Promise(resolve => { resolveRequest = resolve }) }
  return original.call(this, name, ...args)
}
require('../pages/index/index')
Module._load = original
const page = Object.assign({}, definition)
async function run() {
  let task = page.contact()
  resolveRequest(' 12345678901 ')
  await task
  assert.equal(call, '12345678901')
  call = null
  task = page.contact()
  session = { tenantId: 2, accessToken: 'b' }
  resolveRequest('12345678901')
  await task
  assert.equal(call, null)
  task = page.contact()
  resolveRequest('')
  await task
  assert.equal(toast, '未获取到客服电话')
  console.log('客服电话读取、账号切换和空号码检查通过')
}
run().catch(error => { console.error(error); process.exitCode = 1 })
