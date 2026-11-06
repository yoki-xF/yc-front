import assert from 'node:assert/strict'
import {test} from 'vitest'
import {profilePayload,passwordPayload} from './profile.js'
test('资料与密码校验不放宽字段白名单',()=>{
assert.deepEqual(profilePayload({nickname:' 店长 ',email:'',mobile:'',id:99,deptId:99,roles:[1]},{sex:2}),{nickname:'店长',email:'',sex:2})
assert.throws(()=>profilePayload({nickname:'店长',mobile:''},{mobile:'13800000000'}),/清空/)
assert.throws(()=>profilePayload({nickname:'店长',email:'bad'},{}),/邮箱/)
assert.deepEqual(passwordPayload({oldPassword:' old ',newPassword:' new ',confirmation:' new ',id:99}),{oldPassword:' old ',newPassword:' new '})
assert.throws(()=>passwordPayload({oldPassword:'abcd',newPassword:'efgh',confirmation:'ijkl'}),/不一致/)
assert.throws(()=>passwordPayload({oldPassword:'abcd',newPassword:'abcd',confirmation:'abcd'}),/相同/)


})
