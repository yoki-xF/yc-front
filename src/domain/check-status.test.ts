import {expect,test} from 'vitest'
import {checkRows} from './check-status'
test('记录状态不等于已结店，模式不需要时不能误显示待办',()=>{
 const rows=checkRows({morningCheck:true,nightCheck:false,fundCheck:true,businessCheck:false,requireInventory:true,requireFund:true},'9007199254740993')
 expect(rows.map(r=>r.state)).toEqual(['已提交','未提交','未提交','已提交']);expect(rows[0].to).toContain('9007199254740993')
 const skip=checkRows({morningCheck:true,nightCheck:true,fundCheck:true,businessCheck:false,requireInventory:false,requireFund:false},'1');expect(skip[0].state).toBe('当前模式不需要');expect(skip[1].required).toBe(true)
 expect(()=>checkRows({morningCheck:true},'1')).toThrow()
})
