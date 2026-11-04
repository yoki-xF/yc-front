const assert=require('node:assert/strict')
const Module=require('node:module'),load=Module._load
let calls=[],responder=async()=>true,active=true
const fakeApi={active(){if(!active)throw Error('账号已变化');return {accessToken:'token',tenantId:1}},identity:async()=>({permissions:['sport:staff-schedule:query','sport:staff-schedule:create','sport:staff-schedule:update']})}
Module._load=function(name,parent,main){
  if(name==='../request')return {request:async(path,options)=>{calls.push({path,options});return responder(path,options)}}
  if(name==='./api'||name==='../../../utils/boss/api')return fakeApi
  return load.call(this,name,parent,main)
}
const schedules=require('../utils/boss/schedules')
let page;global.Page=p=>{page=p}
require('../pages/boss/schedule/index');Module._load=load
const depts=[{id:'10',name:'A'},{id:'11',name:'B'}],opts={users:[{id:'1',name:'员工'}],configs:[{id:'5',name:'早班'}]}
const values={deptId:'10',userId:'1',configId:'5',date:'2026-11-02',status:1,startClockTime:'forged',deptName:'forged'}
assert.deepEqual(schedules.payload(values,{},depts,opts),{deptId:'10',userId:'1',configId:'5',date:'2026-11-02',status:1})
assert.throws(()=>schedules.payload({...values,userId:'2'},{},depts,opts),/员工/)
assert.throws(()=>schedules.payload({...values,date:'2026-02-30'},{},depts,opts),/日期/)
assert.throws(()=>schedules.payload(values,{id:'20',deptId:'11',revision:'v'},depts,opts),/更换门店/)
assert.throws(()=>schedules.payload(values,{id:'20',deptId:'10'},depts,opts),/版本/)
async function run(){
  responder=async()=>{throw Error('timeout')};calls=[]
  await assert.rejects(schedules.save({},values,{},depts,opts),e=>e.mayHaveWritten===true)
  assert.equal(calls.length,1);assert.equal(calls[0].path,'/sport/boss/schedules/create');assert.equal(calls[0].options.method,'POST')
  const waiting={},original=schedules.options
  schedules.options=(_,id)=>new Promise(resolve=>{waiting[id]=resolve})
  const instance={data:{...page.data},optionsVersion:0,session:{},current:()=>true,setData(p){Object.assign(this.data,p)}}
  const first=page.loadOptions.call(instance,'10'),second=page.loadOptions.call(instance,'11')
  waiting['11']({users:[{id:'2',name:'B员工'}],configs:[]});await second
  waiting['10'](opts);await first
  assert.equal(instance.data.users[0].name,'B员工');assert.equal(instance.data.optionsLoading,false)
  schedules.options=original
  active=false;calls=[]
  await assert.rejects(schedules.save({},values,{},depts,opts),/账号已变化/)
  assert.equal(calls.length,0)
  console.log('排班白名单、门店/员工/班次校验、版本保留、未知结果防重和门店切换迟到响应检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
