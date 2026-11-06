import { expect, test } from 'vitest'
import { amount, fundKeys, openingCommand, openingOptions, openingStatus, openingStorageKey, quantity, readOpeningCommand, totalFunds, validateSelection, type Funds } from './store-opening'
const dept = '9007199254740993', material = '9007199254740995', revision = 'a'.repeat(64)
const funds: Funds = { xj: '9999999999.99', wxBalance: '0.01', hsk: '0', zfb: '0', szRmb: '0' }
const lines = [{ materialId: material, packageNum: '1000000', sheetNum: '0', revision }]
const create = () => openingCommand(dept, '首次开店基线', funds, lines, 'opening-request-12345')
const options = () => openingOptions({ departments: [{ id: dept, name: '一店' }], materials: [{ id: material, materialName: '票种', brandName: '品牌', money: '0.10', price: '20.00', num: 200, revision }] })
test('长ID和精确金额保持字符串，五类资金总额不经过浮点运算', () => {
  const c = create(); expect(c.deptId).toBe(dept); expect(c.lines[0]?.materialId).toBe(material)
  expect(c.funds.xj).toBe('9999999999.99'); expect(c.funds.hsk).toBe('0.00'); expect(totalFunds(c.funds)).toBe('10000000000.00')
  expect(() => openingCommand(String(Number(dept)), '首次开店基线', funds, [{...lines[0]!, materialId: Number(material) as any}], c.requestKey)).toThrow()
})
test('明确填写所有资金，拒绝超限、负数、指数及小数精度丢失', () => {
  for (const value of ['', '-1', '1e2', '0.001', '01', '10000000000', 0.1]) expect(() => amount(value)).toThrow()
  expect(amount('0')).toBe('0.00')
  for (const key of fundKeys) { const missing = {...funds}; delete (missing as any)[key]; expect(() => openingCommand(dept, '首次开店基线', missing, lines, create().requestKey)).toThrow() }
})
test('库存零数量合法，最多一百万，禁止重复、缺少票种或无效revision', () => {
  expect(quantity('0')).toBe('0'); expect(quantity('1000000')).toBe('1000000')
  for (const value of ['1000001','-1','1.0','01','',1]) expect(() => quantity(value)).toThrow()
  for (const bad of [[], [...lines,...lines], [{...lines[0]!, revision:'b'}], Array.from({length:501}, (_,i) => ({...lines[0]!, materialId: String(i+1)}))]) expect(() => openingCommand(dept, '首次开店基线', funds, bad, create().requestKey)).toThrow()
})
test('选项来自管理范围且匹配服务端原始票种revision，正价格才可初始化', () => {
  const o = options(); expect(() => validateSelection(create(),o)).not.toThrow()
  expect(() => validateSelection(create(),{...o,departments:[]})).toThrow()
  o.materials[0]!.revision = 'b'.repeat(64); expect(() => validateSelection(create(),o)).toThrow()
  o.materials[0]!.revision = revision; o.materials[0]!.price = '0.00'; expect(() => validateSelection(create(),o)).toThrow()
  expect(() => openingOptions({departments:[{id: Number(dept),name:'不精确'}], materials:[]})).toThrow()
})
test('刷新恢复完全相同的命令及请求编号，不允许损坏/跨店记录变成新命令', () => {
  const command = create(), serialized = JSON.stringify(command)
  expect(JSON.stringify(readOpeningCommand(serialized,dept))).toBe(serialized)
  expect(readOpeningCommand(null,dept)).toBeNull()
  for (const raw of ['', '{}', '{', JSON.stringify({...command, funds:{...command.funds,xj:'-1'}})]) expect(() => readOpeningCommand(raw,dept)).toThrow()
  expect(() => readOpeningCommand(serialized,'2')).toThrow()
  expect(openingStorageKey('1','2',dept)).not.toBe(openingStorageKey('1','3',dept))
  expect(openingStorageKey('1','2',dept)).not.toBe(openingStorageKey('2','2',dept))
})
test('初始化状态必须完整且禁止已初始化后重复初始化，说明与请求key受限', () => {
  expect(openingStatus({initialized:true,canInitialize:false,reason:'已完成'}).canInitialize).toBe(false)
  for (const raw of [{}, {initialized:true,canInitialize:true,reason:''}]) expect(() => openingStatus(raw)).toThrow()
  for (const reason of ['短', '字'.repeat(501)]) expect(() => openingCommand(dept,reason,funds,lines,create().requestKey)).toThrow()
  expect(() => openingCommand(dept,'首次开店基线',funds,lines,'short')).toThrow()
})
test('初始化库存金额按包价和面值定点计算，不用浮点数，待确认旧版本不冒充当前价格',async()=>{
 const {totalStock}=await import('./store-opening')
 const c=create(),o=options();expect(totalStock(c,o)).toBe('20000000.00')
 o.materials[0]!.revision='b'.repeat(64);expect(totalStock(c,o)).toBe('待服务器核对')
})
