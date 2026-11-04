const assert=require('assert')
const apiPath=require.resolve('../utils/admin-pay/wallet')
const calls=[]
require.cache[apiPath]={id:apiPath,filename:apiPath,loaded:true,exports:{id:v=>String(v),permit:async()=>{},call:async(s,path,options)=>{calls.push({path,options});return true}}}
let page
global.Page=x=>{page=x}
global.wx={getStorageSync:()=>({tenantId:'1'}),setStorageSync(){},removeStorageSync(){},showModal:o=>o.success({confirm:true})}
function instance(def,data){return Object.assign({},def,{data,alive:true,session:{tenantId:'1'},lockKey:'test',setData(p){Object.assign(this.data,p)},load(){}})}
;(async()=>{
 require('../pages/admin-pay/app/index')
 let p=instance(page,{loading:false,locked:false,form:{id:'9007199254740993',revision:'v1',name:'A',appKey:'a',status:0,orderNotifyUrl:'https://a',refundNotifyUrl:'https://b'}})
 await p.save();assert.strictEqual(calls[0].path,'/pay/admin-native/app-update');assert.strictEqual(calls[0].options.data.id,'9007199254740993');assert.strictEqual(calls[0].options.data.revision,'v1')
 require('../pages/admin-pay/channel/index')
 p=instance(page,{loading:false,locked:false,form:{id:'2',revision:'v2',appId:'9007199254740993',code:'wx_lite',status:0,feeRate:'1',remark:'',config:'{}'}})
 await p.save();assert.strictEqual(calls[1].path,'/pay/admin-native/channel-update');assert.strictEqual(calls[1].options.data.config,'{}');assert.strictEqual(calls[1].options.data.revision,'v2')
 p=instance(page,{loading:false,locked:false,form:{id:'2',appId:'1',status:0,feeRate:'0',config:'{}'}});await p.save();assert.strictEqual(calls.length,2);assert.match(p.data.error,/版本/)
 console.log('admin-pay application/channel guarded writes passed')
})().catch(e=>{console.error(e);process.exitCode=1})
