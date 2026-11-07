import { describe, expect, it } from 'vitest'
import { allowedActions, checkedLines, choices, decimal, journalKey, ledgerId, lineTotal, qty, readJournal, revisionOf, snapshot, transitionPath, verified } from './order-ledger'
const rev='a'.repeat(64), id='9223372036854775806', order={stat:0,orderNo:'T'+'a'.repeat(32)}
const option={id,name:'票',price:'10.10',money:'0.20',packageNum:10,sheetNum:10}
const line={materialId:id,packageNum:'2',sheetNum:'3',expectedPrice:'10.10',expectedMoney:'0.20'}
describe('employee order ledger',()=>{
 it('limits actions to direction and pending modern orders',()=>{
  expect(allowedActions('transfer','in',order)).toEqual(['edit','cancel'])
  expect(allowedActions('transfer','out',order)).toEqual(['confirm'])
  expect(allowedActions('purchase','in',{stat:'0'})).toEqual(['edit','confirm','cancel'])
  for(const stat of [1,2,3])expect(allowedActions('purchase','in',{stat})).toEqual([])
  expect(allowedActions('transfer','out',{...order,orderNo:'OLD'})).toEqual([])
 })
 it('preserves long ids and rejects rounded numeric ids',()=>{
  expect(ledgerId(id)).toBe(id);expect(()=>ledgerId(Number(id))).toThrow()
  expect(snapshot({order:{id,deptId:id},items:[],revision:rev},'purchase',id,'in').order.id).toBe(id)
  expect(()=>snapshot({order:{id,deptId:'1',exDeptId:'2'},direction:'out',items:[],revision:rev},'transfer','1','in')).toThrow()
 })
 it('uses exact cents and rejects unsafe JSON numeric prices',()=>{
  expect(decimal(0.29)).toBe('0.29');expect(decimal('999999999999999999.99')).toBe('999999999999999999.99')
  for(const v of [1.001,0.1+0.2,1000000000.01,NaN,-1,'1e2','0.001'])expect(()=>decimal(v)).toThrow()
  expect(lineTotal([line])).toBe('20.80')
  expect(()=>lineTotal([{...line,expectedPrice:'999999999999999999.99'}])).toThrow()
 })
 it('validates quantity and catalogue/source snapshots',()=>{
  for(const v of ['-1','1.5','01','1000001','1e3'])expect(()=>qty(v)).toThrow()
  expect(qty('1000000')).toBe(1000000)
  expect(checkedLines([line],[option])[0]?.materialId).toBe(id)
  expect(()=>checkedLines([{...line,packageNum:'0',sheetNum:'0'}],[option])).toThrow()
  expect(()=>checkedLines([line,line],[option])).toThrow()
  expect(()=>checkedLines(Array.from({length:101},()=>line),[option])).toThrow()
  expect(()=>checkedLines([line],[{...option,price:'11.00'}])).toThrow()
  expect(()=>checkedLines([line],[{...option,packageNum:1}])).toThrow()
  expect(()=>checkedLines([line],[])).toThrow()
  expect(choices([{id,materialName:'票',price:10.1,money:0.2}])[0]?.price).toBe('10.10')
 })
 it('preserves revision and uses POST transition URL queries',()=>{
  expect(revisionOf(rev)).toBe(rev);expect(()=>revisionOf('1')).toThrow()
  const path=transitionPath('transfer','confirm','2',id,rev)
  expect(path).toContain('deptId=2');expect(path).toContain('id='+id);expect(path).toContain('revision='+rev)
 })
 it('scopes unknown journal across stable tenant actor dept type order, independent of login/day/direction',()=>{
  const base=journalKey('1','2','3','transfer',id)
  expect(base).toBe(journalKey('1','2','3','transfer',id))
  for(const k of [journalKey('2','2','3','transfer',id),journalKey('1','3','3','transfer',id),journalKey('1','2','4','transfer',id),journalKey('1','2','3','purchase',id),journalKey('1','2','3','transfer')])expect(k).not.toBe(base)
  expect(()=>readJournal('{}')).toThrow();expect(readJournal(null)).toBeNull()
  const j={action:'create' as const,day:'old-day',payload:{items:[line]},sentAt:'now'}
  const s={order:{stat:0},items:[],revision:rev,direction:'in' as const}
  expect(verified(j,s)).toBe(false)
  expect(verified({...j,action:'confirm'},s)).toBe(false)
  expect(verified({...j,action:'confirm'},{...s,order:{stat:'1'}})).toBe(true)
  expect(verified({...j,action:'cancel'},{...s,order:{stat:1}})).toBe(false)
  const edited={...s,revision:'b'.repeat(64),items:[{materialId:id,packageNum:2,sheetNum:3,price:'10.10',money:'0.20'}]}
  expect(verified({...j,action:'edit',revision:rev},edited)).toBe(true)
  expect(verified({...j,action:'edit',revision:rev},{...edited,items:[{...edited.items[0],packageNum:4}]})).toBe(false)
 })
})

import {writeResult,requireEditorDay,createdLabel} from './order-ledger'
it('不完整的成功响应不能清理未知结果；创建回执必须是精确单据ID',()=>{
 expect(writeResult('create','9007199254740993')).toBe('9007199254740993')
 expect(writeResult('confirm',true)).toBeNull()
 for(const invalid of [null,false,{},'true'])expect(()=>writeResult('edit',invalid)).toThrow()
 for(const invalid of [null,0,9007199254740993,'9223372036854775808'])expect(()=>writeResult('create',invalid)).toThrow()
})

it('源库存可超过单笔上限，但表单跨营业日必须重新核对',()=>{
 expect(choices([{materialId:id,materialName:'大库存',price:10,money:1,packageNum:2000000,sheetNum:0}],true)[0]?.packageNum).toBe(2000000)
 expect(()=>qty(2000000)).toThrow()
 expect(()=>requireEditorDay('old-day','new-day')).toThrow('营业日')
 expect(()=>requireEditorDay('','new-day')).toThrow()
 expect(()=>requireEditorDay('same-day','same-day')).not.toThrow()
})

it('创建日期可用于人工查单，不将毫秒时间戳原样显示',()=>{
 expect(createdLabel('2026-11-07T15:30:01')).toBe('2026-11-07 15:30:01')
 expect(createdLabel(1794036600000)).toContain('2026')
 expect(createdLabel(null)).toBe('时间待核对')
})
