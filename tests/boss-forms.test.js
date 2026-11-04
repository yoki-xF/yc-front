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
assert.deepEqual(payload('users',user,original,depts),{id:1,username:'boss01',nickname:'老板',deptId:'1',deptIds:['1'],mobile:'',email:'',remark:'',avatar:'original-avatar'})
assert.equal(payload('users',{...user,deptId:'9007199254740993',deptIds:['9007199254740993']},original,[{id:'9007199254740993',name:'大编号门店'}]).deptId,'9007199254740993')
assert.equal(fields('users',true).some(f=>f.key==='password'),false)
assert.throws(()=>payload('users',{...user,password:'abc'},{},depts),/密码/)
assert.throws(()=>payload('users',{...user,password:'validpass',deptIds:['99']},{},depts),/门店/)
assert.throws(()=>fields('business',true),/暂不支持/)
console.log('金额精度、部门范围、权限名称、角色枚举及用户编辑保留字段检查通过')

const postOptions=[{id:'9007199254740993',name:'Active',status:'0'},{id:'2',name:'Inactive',status:'1'}]
const changed=payload('users',{...user,sex:'0',postIds:['9007199254740993','2']},original,depts,postOptions)
assert.equal(changed.sex,0)
assert.deepEqual(changed.postIds,['9007199254740993','2'])
assert.deepEqual(payload('users',{...user,postIds:[]},original,depts,postOptions).postIds,[])
assert.equal(Object.hasOwn(payload('users',user,original,depts),'sex'),false)
assert.equal(Object.hasOwn(payload('users',user,original,depts),'postIds'),false)
for(const sex of ['3','',-1,'1.0'])assert.throws(()=>payload('users',{...user,sex},original,depts,postOptions),/性别/)
for(const postIds of [['99'],['3'],['2']])assert.throws(()=>payload('users',{...user,password:'validpass',postIds},{},depts,postOptions),/岗位/)
assert.deepEqual(payload('users',{...user,password:'validpass',sex:2,postIds:['9007199254740993']},{},depts,postOptions).postIds,['9007199254740993'])
// Exercise the native checkbox handler: disabled assignments survive checkbox events.
let page
global.Page=p=>{page=p}
const api=require('../utils/boss/api')
const active=api.active;api.active=()=>({})
require('../pages/boss/form/index')
const ctx={...page,data:{busy:false,saved:false,fields:[{key:'postIds',kind:'posts',options:[{id:'2',disabled:true},{id:'9007199254740993',disabled:false}]}]},original:{postIds:['2']},setData(update){this.update=update}}
ctx.check({currentTarget:{dataset:{key:'postIds'}},detail:{value:['9007199254740993']}})
assert.deepEqual(ctx.update['values.postIds'],['9007199254740993','2'])
api.active=active;delete global.Page
console.log('性别、岗位清空/省略、新增、停用保留与精确字符串编号检查通过')
