const assert=require('node:assert/strict'),Module=require('node:module')
let calls=[],responder=async()=>true
const fakeApi={active:()=>({tenantId:1,accessToken:'test-token'}),identity:async()=>({permissions:['system:role:query','system:permission:assign-role-menu','system:permission:assign-role-data-scope']})}
const load=Module._load;Module._load=function(name,parent,main){if(name==='./api')return fakeApi;if(name==='../request')return{request:async(p,o)=>{calls.push({path:p,options:o});return responder(p,o)}};return load.call(this,name,parent,main)}
const actions=require('../utils/boss/role-actions');Module._load=load
const record={id:'20',revision:'v1',canMenus:true,canScope:true,menus:[{id:'100',name:'盘点',parentId:'0'},{id:'101',name:'查询',parentId:'100'},{id:'102',name:'编辑',parentId:'100'}],departments:[{id:'10',name:'A'}]}
assert.equal(actions.menuLabels(record.menus)[1].label,'盘点 / 查询')
assert.deepEqual(actions.mergeSelection(['100','101'],[{id:'101'},{id:'102'}],['102']),['100','102'])
assert.deepEqual(actions.payload('scope',record,{dataScope:1,deptIds:['99']}),{id:'20',revision:'v1',dataScope:1,deptIds:[]})
assert.throws(()=>actions.payload('scope',record,{dataScope:2,deptIds:['99']}),/门店/)
assert.throws(()=>actions.payload('menus',record,{menuIds:['999']}),/不可分配/)
assert.throws(()=>actions.payload('__proto__',record,{}),/重新读取/)
assert.deepEqual(actions.payload('menus',record,{menuIds:['100','101'],dataScope:1,id:99}),{id:'20',revision:'v1',menuIds:['100','101']})
async function run(){await actions.save({},'scope',record,{dataScope:2,deptIds:['10']});assert.equal(calls[0].path,'/system/boss/role-actions/scope');assert.equal(calls[0].options.method,'PUT');calls=[];responder=async()=>{throw Error('timeout')};await assert.rejects(actions.save({},'menus',record,{menuIds:['100']}),e=>e.mayHaveWritten===true);assert.equal(calls.length,1);console.log('角色功能/门店白名单、版本、搜索保留隐藏选择及未知结果防重检查通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
