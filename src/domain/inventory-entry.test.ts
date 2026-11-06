import {expect,test} from 'vitest'
import {countLines,countTotal,countPayload,morningAmounts,morningSummary} from './inventory-entry'
const dept='9007199254740993',stocks=[{id:'9007199254740995',materialId:'4',deptId:dept,materialName:'票',price:'1.20',money:'0.10',packageNum:2,sheetNum:3}]
test('库存用包价及张价定点核算，零实盘仍保留库存行和长ID',()=>{
 const lines=countLines([],stocks,dept);expect(countTotal(lines,'morning').amount).toBe('2.70')
 lines[0].invPackageNum='0';lines[0].invZhangNum='0';expect(countPayload(lines,'evening',dept)[0]).toMatchObject({inventoryId:'9007199254740995',invPackageNum:0})
})
test('早盘差额重新核算，五资金缺失不能当零',()=>{
 const lines=countLines([],stocks,dept),values=morningAmounts({xj:'100.00',wxBalance:'0',hsk:'0',zfb:'0',szRmb:'0',locked:false,hidden:false,started:false})
 values.morningCashDesc='99.99';lines[0].invZhangNum='2'
 expect(morningSummary(lines,stocks,values,'100')).toEqual({invCount:'2.60',invYesterdayDiff:'-0.10',invCashDiff:'-0.01'})
 expect(()=>morningAmounts({locked:false,hidden:false,started:false})).toThrow()
})
test('已保存盘点保留实盘数量，新增库存仍进入明细；拒绝跨门店重复和越界',()=>{
 const lines=countLines([{materialId:'4',invPackageNum:0,invZhangNum:0}],stocks,dept)
 expect(lines[0].invPackageNum).toBe('0');expect(countLines([],stocks,dept)).toHaveLength(1)
 expect(()=>countLines([],stocks,'2')).toThrow();expect(()=>countLines([],stocks.concat(stocks),dept)).toThrow()
 lines[0].invPackageNum='1000000';expect(()=>countTotal(lines,'morning')).toThrow();expect(countTotal(lines,'evening').packages).toBe('1000000')
})
