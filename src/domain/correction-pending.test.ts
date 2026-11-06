import {expect,test} from 'vitest'
import {command,definitions,reports} from './corrections.js'
import {correctionPending} from './correction-pending'
const original={id:'9007199254740993',revision:'a'.repeat(64),xj:'100.00',sellId:'7',wxBalance:'0.00'}
test('财务更正只发送白名单变更、原因与原版本，金额保持字符串',()=>{
 const c=command('funds',original,{xj:'101.01',wxBalance:'0.00',sellId:'8'},[],'更正现金盘点录入错误','review-request-12345678')
 expect(c.fields).toEqual({xj:'101.01'});expect(c.revision).toBe(original.revision);expect(c.id).toBe(original.id)
 expect(()=>command('funds',original,{xj:'1.001'},[],'原因','a')).toThrow()
 expect(definitions('inventory',{remark:'',morningCashDesc:'100'}).map((f:any)=>f.key)).toEqual(['remark'])
 expect(reports({variance:'0.00'},{variance:'1.01'})[0]).toMatchObject({before:'0.00',after:'1.01'})
})
test('恢复的未知结果请求必须仍属同一记录及类型，保留同一个请求标识',()=>{
 const c=command('funds',original,{xj:'101.00',wxBalance:'0.00'},[],'更正现金盘点录入错误','review-request-12345678')
 expect(correctionPending(JSON.stringify(c),'funds',original.id).requestKey).toBe(c.requestKey)
 for(const patch of [{id:'2'},{type:'business'},{revision:'bad'},{requestKey:'new'},{reason:'短'}])expect(()=>correctionPending(JSON.stringify({...c,...patch}),'funds',original.id)).toThrow()
})
