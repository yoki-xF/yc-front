import { expect, test } from 'vitest'
import { catalogId, catalogPayload, catalogType, catalogValues, requireCatalogPermission, type CatalogContext } from './catalog-form'
const context: CatalogContext = {permissions:['*:*:*'],departments:[{id:'9007199254740993',name:'门店'}],writeScopeAllowed:true}
const material = {materialName:' 票种 ',brandName:'品牌',money:'9999999999.99',price:'0.01',num:'999999999'}
const cost = {deptId:'9007199254740993',costTypeName:'房租',cost:'999999999',belongTime:'2024-02-29'}
test('服务器定点整元金额能直接编辑，绝不截断非整元历史金额', () => {
  const original={id:'1',revision:'a'.repeat(64),...cost,cost:'12.00',belongTime:'2026-11-07T00:00'}
  const values=catalogValues('costs',original)
  expect(values.cost).toBe('12')
  expect(catalogPayload('costs',{...values,costTypeName:'改名'},{...context,original}).cost).toBe(12)
  for(const invalid of ['12.01','-1.00','1000000000.00','12.001'])expect(()=>catalogValues('costs',{...original,cost:invalid})).toThrow('整元')
})
test('exact material command retains decimal and long ID precision, omits unrelated fields', () => {
  expect(catalogPayload('materials',material,context)).toEqual({...material,materialName:'票种',num:999999999})
  expect(catalogId('9007199254740993')).toBe('9007199254740993')
  expect(()=>catalogId(9007199254740993)).toThrow('精度')
  expect(()=>catalogId('9223372036854775808')).toThrow()
  expect(()=>catalogType('users')).toThrow()
})
test('rejects negative, exponent, overflow and excessive precision amounts and invalid counts', () => {
  for (const money of ['-1','1e2','10000000000','0.001','','NaN']) expect(()=>catalogPayload('materials',{...material,money},context)).toThrow()
  for (const num of ['0','1.2','1000000000','-1']) expect(()=>catalogPayload('materials',{...material,num},context)).toThrow()
  for (const value of ['1.01','-1','1000000000']) expect(()=>catalogPayload('costs',{...cost,cost:value},context)).toThrow()
  expect(catalogPayload('costs',{...cost,cost:'0'},context).cost).toBe(0)
})
test('validates calendar dates strictly and preserves unchanged historical time', () => {
  expect(catalogPayload('costs',cost,context).belongTime).toBe('2024-02-29 00:00:00')
  for (const belongTime of ['2023-02-29','2024-04-31','2024-13-01','0000-01-01','2024-2-01','2024-01-01T00:00:00']) expect(()=>catalogPayload('costs',{...cost,belongTime},context)).toThrow()
  const original={id:'1',revision:'a'.repeat(64),...cost,belongTime:'2024-02-29T12:34:56'}
  const values=catalogValues('costs',original)
  expect(catalogPayload('costs',values,{...context,original})).toMatchObject({id:'1',revision:'a'.repeat(64),belongTime:'2024-02-29 12:34:56'})
  expect(catalogPayload('costs',{...values,belongTime:'2024-03-01'},{...context,original}).belongTime).toBe('2024-03-01 00:00:00')
})
test('requires scoped active department, all-data material scope and query plus update for edit', () => {
  expect(()=>catalogPayload('costs',{...cost,deptId:'2'},context)).toThrow('门店')
  expect(()=>catalogPayload('costs',cost,{...context,departments:[]})).toThrow('门店')
  expect(()=>catalogPayload('materials',material,{...context,writeScopeAllowed:false})).toThrow('全部数据')
  expect(()=>requireCatalogPermission('costs',['sport:cost-record:update'],true)).toThrow()
  expect(()=>requireCatalogPermission('costs',['sport:cost-record:create'],false)).not.toThrow()
  expect(()=>catalogPayload('costs',cost,{...context,original:{id:'1'}})).toThrow('版本')
  expect(()=>catalogValues('materials',{materialName:'不完整'})).toThrow('缺失')
  expect(()=>catalogPayload('materials',{...material,materialName:' '.repeat(3)},context)).toThrow()
  expect(()=>catalogPayload('materials',{...material,brandName:'字'.repeat(101)},context)).toThrow()
})
test('accepts backend LocalDateTime minute precision without changing midnight or truncating invalid time',()=>{
 const original={id:'1',revision:'a'.repeat(64),...cost,belongTime:'2026-11-06T00:00'}
 const values=catalogValues('costs',original)
 expect(catalogPayload('costs',values,{...context,original}).belongTime).toBe('2026-11-06 00:00:00')
 expect(()=>catalogValues('costs',{...original,belongTime:'2026-11-06T25:00'})).toThrow()
})
