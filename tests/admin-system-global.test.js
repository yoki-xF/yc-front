const assert=require('node:assert/strict'),Module=require('node:module')
let current={tenantId:1,accessToken:'a',refreshToken:'r'},calls=[]
global.wx={getStorageSync:()=>current}
const old=Module._load;Module._load=function(n,parent,...rest){if(n==='../request'&&parent.filename.endsWith('/admin-system/global.js'))return{sameSession:(a,b)=>!!a&&!!b&&a.refreshToken===b.refreshToken,request:async(path,options)=>{calls.push({path,options});return '9007199254740993'}};return old.call(this,n,parent,...rest)}
const api=require('../utils/admin-system/global');Module._load=old
async function run(){const payload=api.fields('menus',{name:'A',parentId:'9007199254740993',type:'3',sort:'1',permission:'a',path:'',icon:'',component:'',componentName:'',status:'1',visible:'false',keepAlive:'false',alwaysShow:'false'});assert.equal(payload.parentId,'9007199254740993');assert.equal(payload.status,1);await api.save(current,'menus',{id:'9007199254740995',revision:'abc',fields:payload});assert.equal(calls[0].options.data.id,'9007199254740995');const prior=current;current={...prior,refreshToken:'other'};await assert.rejects(()=>api.page(prior,'dict-types',1));assert.throws(()=>api.fields('dict-data',{dictType:'a',label:'b',value:'c',sort:'x',status:'0'}));console.log('全局配置编号、输入和会话保护通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
