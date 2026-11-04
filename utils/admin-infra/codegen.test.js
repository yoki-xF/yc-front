const assert = require('assert')
let session = { tenantId: '1', accessToken: 'access', refreshToken: 'refresh' }
let mode = 'ok', captured
const fs = { readFile() {}, writeFile() {}, unlink() {} }
global.wx = {
  getStorageSync: () => session,
  request(options) {
    captured = options
    if (mode === 'network') return options.fail({})
    if (mode === 'switch') session = { tenantId: '2', accessToken: 'other', refreshToken: 'other' }
    options.success({ statusCode: 200, data: { code: 0, data: mode === 'false' ? false : [] } })
  },
  getFileSystemManager: () => fs
}
const api = require('./codegen')
assert.strictEqual(api.id('9007199254740993'), '9007199254740993')
assert.throws(() => api.id(9007199254740992), /精度/)
assert.throws(() => api.id('0'), /无效/)
assert.throws(() => api.validate({ table: {}, columns: [] }), /不完整/)
const valid={table:{id:'1',parentMenuId:'0',scene:1,templateType:1,frontType:20,tableName:'users',tableComment:'用户',moduleName:'system',businessName:'user',className:'User',classComment:'用户',author:'admin'},columns:[{id:'2',tableId:'1',columnName:'name',dataType:'varchar',columnComment:'名称',javaType:'String',javaField:'name',listOperationCondition:'=',htmlType:'input'}]}
assert.strictEqual(api.validate(valid),valid)
valid.table.parentMenuId='9007199254740993';assert.strictEqual(api.validate(valid),valid)
valid.table.parentMenuId=9007199254740992;assert.throws(()=>api.validate(valid),/精度/)

let page
global.Page = definition => { page = definition }
require('../../pages/admin-infra/form-build/index')
const ctx = { data: { rule: '[{"type":"input","field":"a"}]', option: '{}', error: '', result: '' }, setData(v) { Object.assign(this.data, v) } }
page.check.call(ctx)
assert.match(ctx.data.result, /"field": "a"/)
ctx.data.rule = '[{"field":"a"}]'; page.check.call(ctx); assert.match(ctx.data.error, /类型/)
ctx.data.rule = '[]'; ctx.data.option = '[]'; page.check.call(ctx); assert.match(ctx.data.error, /对象/)
;(async () => {
  const start = session
  await api.call(start, 'codegen/table/page', 'GET', { pageNo: 1 })
  assert.match(captured.url, /\/infra\/admin-native\/codegen\/table\/page$/)
  assert.strictEqual(captured.header.Authorization, 'Bearer access')
  mode = 'false'; await assert.rejects(api.call(start, 'codegen/update', 'PUT', {}), e => e.mayHaveWritten === true)
  mode = 'network'; await assert.rejects(api.call(start, 'codegen/update', 'PUT', {}), e => e.mayHaveWritten === true)
  mode = 'switch'; await assert.rejects(api.call(start, 'codegen/detail', 'GET', {}), /账号已(?:变化|切换)/)
  console.log('admin-infra isolated validation, contract, session and uncertain-write tests passed')
})().catch(e => { console.error(e); process.exitCode = 1 })
