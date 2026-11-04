const assert = require('node:assert/strict'), Module = require('node:module')
let definition, count = 0, fail = false, sent, revision = 'v1', accept = true
const session = { tenantId: 1, accessToken: 'a', refreshToken: 'r' }, storage = { yc_session: session }
global.wx = { getStorageSync: k => storage[k], setStorageSync: (k,v) => { storage[k] = structuredClone(v) }, removeStorageSync: k => { delete storage[k] }, showToast() {}, showModal: o => o.success({ confirm: accept }) }
global.Page = value => { definition = value }
const original = Module._load
Module._load = function(name,...args) {if(name==='../../utils/operating-day')return require('./operating-day-fixture'); if (name === '../../utils/request') return { sameSession: (a,b) => !!(a && b && a.refreshToken === b.refreshToken && a.tenantId === b.tenantId), request: async (path,opts) => {
 if (path.endsWith('/night/count/bill/data')) return { revision, materialVOList: [{ inventoryId: 3, materialId: 2, materialName: '票', money: 0.10, price: 1.20, invPackageNum: 2, invZhangNum: 3 }] }
 if (path.endsWith('/material/List')) return []
 if (path.endsWith('/night/count/bill/safe-submit')) { count++; sent=opts.data; if (fail) throw Error('未知结果'); return true }
} }; return original.call(this,name,...args) }
require('../pages/evening/index'); Module._load=original
const page = Object.assign({},definition,{ data: structuredClone(definition.data), setData(obj) { for (const [key,val] of Object.entries(obj)) { const m=/^items\[(\d+)\]\.(\w+)$/.exec(key); if (m) this.data.items[Number(m[1])][m[2]]=val; else this.data[key]=val } } })
async function run() {
 page.onLoad({ deptId:'1', userId:'1', deptName:'测试' }); await new Promise(r => setImmediate(r))
 assert.equal(page.data.total,'2.70'); assert.equal(page.data.packages,'2'); assert.equal(page.data.sheets,'3')
 page.inputItem({ currentTarget:{ dataset:{ index:0,field:'invZhangNum' } },detail:{value:'4'} }); assert.equal(page.data.total,'2.80'); assert.equal(storage[page.draftKey].items[0].invZhangNum,'4')
 fail=true; await page.submit(); assert.equal(page.data.uncertain,true); await page.submit(); assert.equal(count,1)
 page.confirmChecked(); fail=false; await page.submit(); assert.equal(count,2); assert.equal(sent.materialVOList[0].inventoryId,3); assert.equal(sent.revision,'v1'); assert.equal(storage[page.draftKey],undefined)
 page.inputItem({ currentTarget:{ dataset:{ index:0,field:'invZhangNum' } },detail:{value:'8'} }); revision='v2'; await page.load(); assert.equal(page.data.conflict,true); assert.equal(page.data.items[0].invZhangNum,'8'); accept=false; page.reloadLatest(); assert.equal(storage[page.draftKey].items[0].invZhangNum,'8'); accept=true; page.reloadLatest(); await new Promise(r=>setImmediate(r)); assert.equal(page.data.conflict,false); assert.equal(storage[page.draftKey],undefined); assert.equal(page.revision,'v2')
 console.log('晚盘点计算、版本冲突、草稿保护和提交未知状态检查通过')
}
run().catch(err => { console.error(err); process.exitCode=1 })
