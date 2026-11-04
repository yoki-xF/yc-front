const assert=require('node:assert/strict'),Module=require('node:module'),load=Module._load
let session={tenantId:1,accessToken:'catalog-test'},calls=[],resolveRead,writeScopeAllowed=true
global.wx={getStorageSync:()=>session}
Module._load=function(name,parent,main){
  if(name==='../request')return {sameSession:(a,b)=>!!a&&!!b&&a.tenantId===b.tenantId&&a.accessToken===b.accessToken,request:async(path,options)=>{
    calls.push({path,options})
    if(path.endsWith('permission-info'))return {user:{id:1},permissions:['*:*:*']}
    if(path==='/sport/boss/departments')return [{id:'10',name:'Store'}]
    if(resolveRead)return new Promise(r=>{resolveRead=r})
    if(path.endsWith('/get'))return {id:'1',deptId:'10',cost:100,revision:'v1'}
    if(path.endsWith('/update'))return true
    if(path.endsWith('/create'))return '9007199254740993'
    return {list:[],total:0,writeScopeAllowed}
  }}
  return load.call(this,name,parent,main)
}
const api=require('../utils/boss/api');Module._load=load
async function run(){
  const form=await api.form(session,'costs','1')
  assert.equal(form.record.revision,'v1');assert.ok(calls.some(c=>c.path==='/sport/boss/catalog/costs/get'))
  const values={deptId:'10',costTypeName:'Rent',cost:'200',belongTime:'2026-11-02'}
  calls=[];await api.save(session,'costs',values,form.record,form.departments)
  const write=calls.find(c=>c.path.endsWith('/update'))
  assert.equal(write.path,'/sport/boss/catalog/costs/update');assert.equal(write.options.data.revision,'v1')
  assert.equal(write.options.data.deptId,'10');assert.equal(write.options.header['tenant-id'],'1')
  calls=[];await assert.rejects(api.save(session,'costs',values,{id:'1'},form.departments),/版本缺失/)
  assert.equal(calls.some(c=>c.path.endsWith('/update')),false)
  calls=[];await api.list(session,'materials',{keyword:'ticket'},1)
  assert.ok(calls.some(c=>c.path==='/sport/boss/catalog/materials/page'))
  calls=[];const material={materialName:'Ticket',brandName:'Brand',money:'10.00',price:'100',num:'10'}
  assert.equal(await api.save(session,'materials',material,{},[]),'9007199254740993')
  assert.equal(calls.find(c=>c.path.endsWith('/create')).path,'/sport/boss/catalog/materials/create')
  writeScopeAllowed=false
  assert.equal((await api.list(session,'materials',{},1)).canCreate,false)
  writeScopeAllowed=true
  calls=[];const userForm=await api.form(session,'users','1')
  assert.ok(calls.some(c=>c.path==='/system/boss/directory/users/get'))
  calls=[];await api.save(session,'users',{username:'demo01',nickname:'Employee',deptId:'10',deptIds:['10'],mobile:'',email:'',remark:''},userForm.record,userForm.departments)
  assert.equal(calls.find(c=>c.path.endsWith('/update')).path,'/system/boss/directory/users/update')
  assert.equal(calls.find(c=>c.path.endsWith('/update')).options.data.revision,'v1')
  calls=[];await api.save(session,'roles',{name:'Manager',code:'manager',sort:'0',status:'0',remark:''},{id:'1',revision:'v1'},[])
  assert.equal(calls.find(c=>c.path.endsWith('/update')).path,'/system/boss/directory/roles/update')
  resolveRead=true;const previous=session,pending=api.form(previous,'materials','1')
  await new Promise(r=>setImmediate(r));session={tenantId:2,accessToken:'other'};resolveRead({id:'1',revision:'v2'})
  await assert.rejects(pending,/账号已变化/)
  console.log('四类普通管理使用范围接口、版本随提交、缺版本拒绝、长整数及换账号检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
