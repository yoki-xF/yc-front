import { expect, test } from 'vitest'
import { profile, profileCommand } from './user-profile'
const value = { id:'9007199254740993', username:'staff', nickname:' 员工甲 ',email:'',mobile:'',sex:'0' }
test('个人资料只提交可编辑字段，不能通过资料表单修改账号或角色', () => {
  expect(profileCommand({...value, roleIds:['1']} as any)).toEqual({nickname:'员工甲',email:'',mobile:'',sex:0})
  expect(profile({...value,id:185}).id).toBe('185')
  expect(profile(value).id).toBe(value.id)
  expect(()=>profile({...value,id:9007199254740993})).toThrow()
})
test('空联系方式明确发送空字符串，拒绝无效联系方式和性别', () => {
  for(const patch of [{nickname:''},{nickname:'字'.repeat(31)},{email:'bad'},{email:'a'.repeat(51)},{mobile:'123'},{mobile:'1e123456789'},{sex:'3'}]) expect(()=>profileCommand({...value,...patch})).toThrow()
  expect(profileCommand({...value,email:'test@example.com',mobile:'13800000000',sex:'2'})).toMatchObject({email:'test@example.com',mobile:'13800000000',sex:2})
})
