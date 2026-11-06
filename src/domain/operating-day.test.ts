import { expect, test } from 'vitest'
import { operatingDay, closingPreview, readDayCommand } from './operating-day'
import { RULE } from './reporting.js'
const id = '01928a10-aabb-4abc-9abc-abcdef123456', deptId = '9007199254740993'
const day = { deptId, id, businessDate:'2026-11-06', status:'OPEN',revision:'1' }
const report = {ruleVersion:RULE,openingFunds:'100.00',closingFunds:'120.00',reserveIn:'0.00',instantSales:'0.00',electronicSales:'15.00',sportsBettingSales:'5.00',totalSales:'20.00',adjustments:'0.00',wrongTicket:'0.00',variance:'0.00'}
const preview = () => ({...day,status:'READY_TO_CLOSE',sourceRevision:'a'.repeat(64),report:{...report},funds:['xj','wxBalance','hsk','zfb','szRmb'].map(key=>({key,opening:key==='xj'?'100.00':'0.00',closing:key==='xj'?'120.00':'0.00'}))})
test('营业日只接受本门店合法状态和版本，不损失长编号',()=>{
 expect(operatingDay(day,deptId).deptId).toBe(deptId)
 expect(operatingDay({deptId,businessDate:'2026-11-06',status:'NOT_OPEN'},deptId).status).toBe('NOT_OPEN')
 for (const patch of [{deptId:'2'},{businessDate:'2026-02-30'},{revision:'9007199254740993'},{id:'bad'},{status:'INVALID'}]) expect(()=>operatingDay({...day,...patch},deptId)).toThrow()
})
test('结店必须核对相同营业日、版本、账务规则和五类资金',()=>{
 const parsed = operatingDay(day,deptId)
 expect(closingPreview(preview(),parsed).report.totalSales).toBe('20.00')
 for (const patch of [{revision:'2'},{sourceRevision:'bad'},{id:'01928a10-aabb-4abc-9abc-abcdef123457'},{report:{...report,totalSales:'21.00'}},{report:{...report,ruleVersion:'old'}},{funds:preview().funds.slice(1)},{funds:preview().funds.map(f=>({...f,opening:'0.00'}))}]) expect(()=>closingPreview({...preview(),...patch},parsed)).toThrow()
})
test('恢复原请求标识，拒绝跨门店或不完整的结店重试',()=>{
 const command = {action:'close',data:{deptId,requestKey:'a'.repeat(36),dayId:id,revision:1,sourceRevision:'b'.repeat(64)}}
 expect(readDayCommand(JSON.stringify(command),deptId)).toEqual(command)
 expect(readDayCommand(null,deptId)).toBeNull()
 expect(()=>readDayCommand(JSON.stringify(command),'2')).toThrow()
 expect(()=>readDayCommand(JSON.stringify({...command,data:{...command.data,sourceRevision:''}}),deptId)).toThrow()
})
