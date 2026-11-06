import { expect, test } from 'vitest'
import { employeeDay, entryDraftKey, entryPayload, entrySnapshot, entryValues, fundFields, businessFields } from './employee-entry'
const actor='9007199254740995',dept='9007199254740993',day='01928a10-aabb-4abc-9abc-abcdef123456'
const amounts = Object.fromEntries(fundFields.filter(f=>!f.count).map(f=>[f.key,'0.00']))
test('五类资金保留精度和负数，选填笔数不自动写零',()=>{
 const record=entryPayload('fund',{...amounts,xj:'-9999999999.99',hskCount:'99999999'},[],null)
 expect(record.xj).toBe('-9999999999.99');expect(record.hskCount).toBe(99999999);expect(record).not.toHaveProperty('wxBalanceCount')
 for(const patch of [{xj:'0.001'},{xj:'10000000000.00'},{xj:'1e3'},{hskCount:'1.5'},{hskCount:'100000000'},{xj:''}])expect(()=>entryPayload('fund',{...amounts,...patch},[],null)).toThrow()
})
test('营业数据须为启用班次，仅发送可编辑字段并保留原凭证',()=>{
 const values=entryValues('business',null);values.classes='Late'
 const record=entryPayload('business',{...values,id:actor,sellId:actor},[{value:'Late'}],{voucherPic:'pv:existing',id:actor})
 expect(record.voucherPic).toBe('pv:existing');expect(record).not.toHaveProperty('id');expect(record).not.toHaveProperty('sellId');expect(record.dcSaleNum).toBe(0)
 expect(Object.keys(record)).toHaveLength(businessFields.length+2)
 expect(()=>entryPayload('business',values,[{value:'Morning'}],null)).toThrow('启用班次')
})
test('读取不把缺失资金当零，不接受已损失精度的数字金额',()=>{
 expect(entryValues('fund',null).xj).toBe('')
 expect(entryValues('fund',{xj:'9999999999.99',hskCount:0})).toMatchObject({xj:'9999999999.99',hskCount:'0'})
 expect(entryValues('fund',{xj:1.1}).xj).toBe('1.1')
 expect(()=>entryValues('fund',{xj:1.123})).toThrow()
 expect(()=>entryValues('fund',{xj:10000000000})).toThrow()
 expect(()=>entrySnapshot({revision:'bad',record:null})).toThrow()
 expect(entrySnapshot({revision:'a'.repeat(64),record:null}).record).toBeNull()
})
test('员工表单拒绝跨账号门店和已结店上下文，草稿按登录及营业日隔离',()=>{
 const raw={id:day,actorId:actor,deptId:dept,status:'OPEN',businessDate:'2026-11-06'}
 expect(employeeDay(raw,dept,actor).id).toBe(day)
 for(const patch of [{actorId:'2'},{deptId:'2'},{status:'CLOSED'}])expect(()=>employeeDay({...raw,...patch},dept,actor)).toThrow()
 const key=entryDraftKey('login',actor,dept,day,'fund')
 expect(new Set([key,entryDraftKey('other',actor,dept,day,'fund'),entryDraftKey('login','2',dept,day,'fund'),entryDraftKey('login',actor,'2',day,'fund'),entryDraftKey('login',actor,dept,'other','fund'),entryDraftKey('login',actor,dept,day,'business')]).size).toBe(6)
})
