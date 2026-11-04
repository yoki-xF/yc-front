const assert=require('node:assert/strict'),Module=require('node:module')
let calls=[],responder=async()=>true,active=true
const info={user:{id:'11'},permissions:['system:user:query','system:user:update','system:user:update-password','system:permission:assign-user-role']}
const fakeApi={active(){if(!active)throw Error('账号已变化');return {tenantId:1,accessToken:'test-token'}},identity:async()=>info}
const load=Module._load
Module._load=function(name,parent,main){if(name==='./api')return fakeApi;if(name==='../request')return{request:async(p,o)=>{calls.push({path:p,options:o});return responder(p,o)}};return load.call(this,name,parent,main)}
const actions=require('../utils/boss/user-actions');Module._load=load
const record={id:'20',revision:'v1',canStatus:true,canReset:true,canAssign:true,roleIds:['2'],roles:[{id:'2',name:'员工'},{id:'3',name:'店长'}]}
assert.deepEqual(actions.payload('roles',record,{roleIds:['2','2'],id:99,tenantId:99}),{id:'20',revision:'v1',roleIds:['2']})
assert.throws(()=>actions.payload('roles',record,{roleIds:['99']}),/不可分配/)
assert.throws(()=>actions.payload('password',record,{password:'abcd',confirmation:'other'}),/不一致/)
assert.throws(()=>actions.payload('status',{...record,canStatus:false},{status:1}),/权限/)
assert.throws(()=>actions.payload('__proto__',record,{}),/重新读取/)
async function run(){
 await actions.save({},'status',record,{status:1});assert.equal(calls[0].path,'/system/boss/user-actions/status');assert.equal(calls[0].options.method,'PUT');assert.deepEqual(calls[0].options.data,{id:'20',revision:'v1',status:1})
 calls=[];responder=async()=>{throw Error('timeout')}
 await assert.rejects(actions.save({},'password',record,{password:'abcd',confirmation:'abcd'}),e=>e.mayHaveWritten===true);assert.equal(calls.length,1)
 calls=[];info.permissions=['system:user:query'];await assert.rejects(actions.save({},'roles',record,{roleIds:['2']}),/没有/);assert.equal(calls.length,0)
 info.permissions.push('system:user:update');active=false;await assert.rejects(actions.get({},'20'),/账号已变化/);assert.equal(calls.length,0)
 console.log('账号操作白名单、目标版本、角色选项范围、对应权限及未知结果防重检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
