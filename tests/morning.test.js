const assert = require('node:assert/strict')
const Module = require('node:module')
let def, submitted, mode = 'ok', revision = 'v1', hidden = false, staffRequests = []
const session = { tenantId: 1, accessToken: 'a', refreshToken: 'r' }, storage = { yc_session: session }
global.wx = { getStorageSync: k => storage[k], setStorageSync: (k,v) => { storage[k] = structuredClone(v) }, removeStorageSync: k => { delete storage[k] }, showToast() {}, showModal: o => o.success({ confirm: true }) }
global.Page = value => { def = value }
const original = Module._load
Module._load = function(name,...args) {if(name==='../../utils/operating-day')return require('./operating-day-fixture');
 if (name === '../../utils/request') return { sameSession: (a,b) => !!(a && b && a.refreshToken === b.refreshToken && a.tenantId === b.tenantId), request: async (path,opts) => {
  if (path.endsWith('/early/count/data')) return { revision, morningFunds: hidden ? { locked: true, hidden: true, started: false, xj: '0.00', wxBalance: '0.00', hsk: '0.00', zfb: '0.00', szRmb: '0.00' } : { locked: false, hidden: false, started: false, xj: 10.10, wxBalance: 2, hsk: 3, zfb: 4, szRmb: 5 }, zchCheckGgl: { checkUserId: 1, morningCashDesc: 10.10, wxBalance: 0, hsk: 0 }, materialVOList: [{ materialId: 2, materialName: '票', money: 0.10, price: 1.20, invPackageNum: 2, invZhangNum: 3 }], zchInventoryGglList: [{ money: 0.10, price: 1.20, packageNum: 1, sheetNum: 3 }], zchInventoryFund: { xj: 9.99 } }
  if (path.endsWith('/store/active-staff')) { staffRequests.push(opts); return [{ value: 1, label: '测试员工' }, { value: 2, label: '同店员工' }] }
  if (path.endsWith('/material/List')) return []
  if (path.endsWith('/early/count/safe-submit')) { submitted = opts.data; if (mode === 'fail') throw Error('网络失败'); return true }
 } }
 return original.call(this,name,...args)
}
require('../pages/morning/index'); Module._load = original
const page = Object.assign({}, def, { data: structuredClone(def.data), setData(obj) { for (const [key,val] of Object.entries(obj)) { const m=/^items\[(\d+)\]\.(\w+)$/.exec(key); if (m) this.data.items[Number(m[1])][m[2]]=val; else this.data[key]=val } } })
async function run() {
 page.onLoad({ deptId: '2', userId: '1', deptName: '门店' }); await new Promise(r => setImmediate(r))
 assert.equal(staffRequests[0].data.deptId,'2'); assert.equal(page.data.users.length,2); assert.equal(page.data.total,'2.70'); assert.equal(page.data.inventoryDiff,'1.20'); assert.equal(page.data.cashDiff,'0.11')
 page.inputItem({ currentTarget: { dataset: { index: 0, field: 'invZhangNum' } }, detail: { value: '4' } })
 assert.equal(page.data.total,'2.80'); assert.equal(storage[page.draftKey].items[0].invZhangNum,'4')
 mode='fail'; await page.submit(); assert.equal(page.data.uncertain,true); assert.equal(storage[page.draftKey].uncertain,true)
 page.confirmChecked(); mode='ok'; await page.submit(); assert.equal(submitted.invCount,'2.80'); assert.equal(submitted.invCashDiff,'0.11'); assert.deepEqual([submitted.morningCashDesc,submitted.wxBalance,submitted.hsk,submitted.zfb,submitted.szRmb],['10.1','2','3','4','5']); assert.equal(storage[page.draftKey],undefined)
 page.input({ currentTarget: { dataset: { field: 'cash' } }, detail: { value: '12' } }); revision = 'v2'; await page.load()
 assert.equal(page.data.conflict, true); assert.equal(page.data.cash, '12'); assert.equal(storage[page.draftKey].revision, 'v1')
 submitted = null; await page.submit(); assert.equal(submitted, null)
 page.reloadLatest(); await new Promise(r => setImmediate(r)); assert.equal(page.data.conflict, false); assert.equal(storage[page.draftKey], undefined)
 hidden=true; await page.load(); assert.equal(page.data.fundsLocked,true); assert.deepEqual([page.data.cash,page.data.wxBalance,page.data.hsk,page.data.zfb,page.data.szRmb],['0.00','0.00','0.00','0.00','0.00']); page.input({currentTarget:{dataset:{field:'zfb'}},detail:{value:'99'}}); assert.equal(page.data.zfb,'0.00');
 page.base.zchInventoryFund=null; page.recalculate(); assert.equal(page.data.cashDiff,'—')
 console.log('早盘点金额、草稿、提交未知状态及期初缺失检查通过')
}
run().catch(err => { console.error(err); process.exitCode=1 })
