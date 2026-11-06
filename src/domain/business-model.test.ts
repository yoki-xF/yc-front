import assert from 'node:assert/strict'
import {test} from 'vitest'
import * as m from './business-model.js'
test('保留业务规则：admin-business-model.test',()=>{
const deps=[{id:'9007199254740993123',name:'A'},{id:'2',name:'B'}]
const id=deps[0].id
assert.deepEqual(m.ids('["9007199254740993123","2"]'),[id,'2'])
assert.deepEqual(m.ids(id+',2'),[id,'2'])
const target=m.payload('targets',{deptId:id,checkDate:'2026-11',salesAmount:'123456789012.01',stat:'0'},deps)
assert.equal(target.deptId,id);assert.equal(target.salesAmount,'123456789012.01');assert.equal(target.checkDate,'2026-11-01 00:00:00')
assert.throws(()=>m.payload('targets',{...target,checkDate:'2026-13'},deps),/月份/)
assert.throws(()=>m.payload('targets',{...target,checkDate:'2026-11',deptId:'999'},deps),/有效门店/)
assert.throws(()=>m.payload('targets',{...target,checkDate:'2026-11',salesAmount:'1e6'},deps),/小数/)
const activity={salesName:'活动',salesCode:'A',startTime:'2026-11-01 00:00:00',endTime:'2026-12-01 00:00:00',deptIds:[id,'2'],salesMoney:'100.00',stat:'0'}
assert.deepEqual(m.payload('activities',activity,deps).deptIds,[id,'2'])
assert.throws(()=>m.payload('activities',{...activity,endTime:activity.startTime},deps),/晚于/)
assert.throws(()=>m.payload('activities',{...activity,deptIds:[id,id]},deps),/有效参与/)
assert.throws(()=>m.payload('departments',{name:'A',parentId:id,sort:'0',status:'0'},deps,{id}),/自己的上级/)
const shift=m.payload('shifts',{deptId:id,name:'早班',shiftType:'1',workStartTime:'08:00',workEndTime:'20:00:59',lateThreshold:'5',earlyLeaveThreshold:'0'},deps,{},[{value:'1',label:'test'}])
assert.equal(shift.workStartTime,'08:00:00')
assert.throws(()=>m.payload('shifts',{...shift,workStartTime:'25:00'},deps,{},[{value:'1',label:'test'}]),/时间格式/)
assert.equal(m.initial('targets',target).checkDate,'2026-11')
assert.throws(()=>m.resource('__proto__'),/不支持/)
})
