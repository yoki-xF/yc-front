const assert = require('node:assert/strict')
const Module = require('node:module')
let definition, submissions = 0, failSubmit = false, revision = 'v1', staffRequests = [], sent
const session = { tenantId: 1, accessToken: 'a', refreshToken: 'r' }, storage = { yc_session: session }
global.wx = { getStorageSync: key => storage[key], setStorageSync: (key,value) => { storage[key] = structuredClone(value) }, removeStorageSync: key => { delete storage[key] }, showToast() {}, showModal: o => o.success({ confirm: true }) }
global.Page = value => { definition = value }
const original = Module._load
Module._load = function (name,...args) {if(name==='../../utils/operating-day')return require('./operating-day-fixture');
  if (name === '../../utils/request') return {
    sameSession: (a,b) => !!(a && b && a.refreshToken === b.refreshToken && a.tenantId === b.tenantId),
    request: async (path,opts) => {
      if (path.endsWith('/store/active-staff')) { staffRequests.push(opts); return [{ value: 1, label: '测试员工' }, { value: '9007199254740993', label: '同店员工' }] }
      if (path.endsWith('/activity/safe-item')) return { revision, items: [{ activityId: 8, activityName: '活动一', salesAmount: null }] }
      if (path.endsWith('/activity/safe-submit')) { submissions++; sent = opts.data; if (failSubmit) throw Error('网络故障'); return true }
    }
  }
  return original.call(this,name,...args)
}
require('../pages/activity/index'); Module._load = original
const page = Object.assign({}, definition, { data: structuredClone(definition.data), setData(obj) { for (const [k,v] of Object.entries(obj)) { const match = /^items\[(\d+)\]\.salesAmount$/.exec(k); if (match) this.data.items[Number(match[1])].salesAmount = v; else this.data[k] = v } } })
async function run() {
  page.onLoad({ deptId: '2', userId: '1', deptName: '门店' })
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(staffRequests[0].data.deptId,'2'); page.changeUser({detail:{value:'1'}}); assert.equal(page.data.users[page.data.userIndex].value,'9007199254740993')
  page.inputAmount({ currentTarget: { dataset: { index: 0 } }, detail: { value: '12.34' } })
  assert.equal(storage[page.draftKey].items[0].salesAmount, '12.34')
  failSubmit = true; await page.submit(); assert.equal(page.data.uncertain, true); assert.equal(storage[page.draftKey].uncertain, true)
  await page.submit(); assert.equal(submissions, 1)
  page.confirmChecked(); assert.equal(page.data.uncertain, false)
  failSubmit = false; await page.submit(); assert.equal(submissions, 2); assert.equal(sent.items[0].userId,'9007199254740993'); assert.equal(storage[page.draftKey], undefined)
  page.inputAmount({ currentTarget: { dataset: { index: 0 } }, detail: { value: '9' } }); revision = 'v2'; await page.load(); assert.equal(page.data.conflict,true); assert.equal(page.data.items[0].salesAmount,'9'); await page.submit(); assert.equal(submissions,2)
  console.log('促销草稿、提交未知状态和重复提交保护检查通过')
}
run().catch(err => { console.error(err); process.exitCode = 1 })
