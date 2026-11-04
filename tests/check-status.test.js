const assert=require('node:assert/strict'),Module=require('node:module')
let definition,navigated,mode=0,calls=[]
const session={tenantId:1,accessToken:'a',refreshToken:'r'}
const storage={yc_session:session};global.wx={getStorageSync:k=>storage[k],navigateTo:o=>{navigated=o.url}};global.Page=p=>definition=p
const old=Module._load;Module._load=function(n,...args){if(n==='../../utils/request')return{sameSession:(a,b)=>a===b,request:async(path,opts)=>{calls.push({path,opts});return mode===0?{morningCheck:true,nightCheck:false,fundCheck:true,businessCheck:false,requireInventory:true,requireFund:true}:{morningCheck:true,nightCheck:true,fundCheck:true,businessCheck:true,requireInventory:false,requireFund:false}}};return old.call(this,n,...args)}
require('../pages/check-status/index');Module._load=old
const page=Object.assign({},definition,{data:structuredClone(definition.data),setData(o){Object.assign(this.data,o)}})
async function run(){page.onLoad({deptId:'1',userId:'1',deptName:'测试'});await new Promise(r=>setImmediate(r));assert.equal(page.data.rows[0].state,'已提交');assert.equal(page.data.rows[1].state,'未提交');page.open({currentTarget:{dataset:{key:'business'}}});assert.ok(navigated.includes('/pages/business/'));mode=1;await page.load();assert.equal(page.data.rows[0].state,'当前模式不需要');navigated='';page.open({currentTarget:{dataset:{key:'morning'}}});assert.equal(navigated,'');assert.equal(page.generate,undefined);assert.ok(calls.every(c=>c.path==='/sport/wx/isGenDeptData'&&!c.opts.method));console.log('盘点进度和只读入口检查通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
