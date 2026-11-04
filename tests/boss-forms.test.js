const assert=require('node:assert/strict')
const {fields,payload}=require('../utils/boss/forms')
const {actionPermission}=(()=>{
  const Module=require('node:module'),load=Module._load
  Module._load=function(name,parent,main){if(name==='../request')return {request(){},sameSession(){}};return load.call(this,name,parent,main)}
  const api=require('../utils/boss/api');Module._load=load;return api
})()
const depts=[{id:1,name:'A'}]
const material={materialName:'票种',brandName:'品牌',money:'20.00',price:'600',num:'30'}
assert.equal(payload('materials',material,{},[]).money,'20.00')
assert.throws(()=>payload('materials',{...material,money:'0.001'},{},[]),/两位/)
assert.throws(()=>payload('materials',{...material,num:'0'},{},[]),/整数/)
assert.throws(()=>payload('materials',{...material,num:'-1'},{},[]),/整数/)
assert.equal(actionPermission({base:'/sport/material-ggl'},'update'),'sport:material-ggl:update')
assert.equal(actionPermission({base:'/system/user'},'create'),'system:user:create')
assert.deepEqual(payload('roles',{name:'店长',code:'boss',sort:'0',status:'0',remark:''},{},[]),{name:'店长',code:'boss',sort:0,status:0,remark:''})
assert.throws(()=>payload('roles',{name:'店长',code:'boss',sort:'0',status:'true',remark:''},{},[]),/状态/)
assert.throws(()=>payload('roles',{name:'管理员',code:'tenant_admin',sort:'0',status:'0',remark:''},{},[]),/系统保留/)
assert.throws(()=>payload('costs',{deptId:2,cost:'100',costTypeName:'租金',belongTime:'2026-11-02'},{},depts),/权限/)
assert.throws(()=>payload('costs',{deptId:1,cost:'100.01',costTypeName:'租金',belongTime:'2026-11-02'},{},depts),/整数/)
const user={username:'boss01',nickname:'老板',deptId:'1',deptIds:['1'],mobile:'',email:'',remark:''}
const original={id:1,postIds:[2],sex:1,avatar:'original-avatar'}
assert.deepEqual(payload('users',user,original,depts),{id:1,username:'boss01',nickname:'老板',deptId:'1',deptIds:['1'],mobile:'',email:'',remark:'',postIds:[2],sex:1,avatar:'original-avatar'})
assert.equal(payload('users',{...user,deptId:'9007199254740993',deptIds:['9007199254740993']},original,[{id:'9007199254740993',name:'大编号门店'}]).deptId,'9007199254740993')
assert.equal(fields('users',true).some(f=>f.key==='password'),false)
assert.throws(()=>payload('users',{...user,password:'abc'},{},depts),/密码/)
assert.throws(()=>payload('users',{...user,password:'validpass',deptIds:['99']},{},depts),/门店/)
assert.throws(()=>fields('business',true),/暂不支持/)
console.log('金额精度、部门范围、权限名称、角色枚举及用户编辑保留字段检查通过')
