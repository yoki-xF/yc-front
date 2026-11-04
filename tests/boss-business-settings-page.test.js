const assert=require('node:assert/strict'),Module=require('node:module')
let definition,current=true,saves=0,saveError,getResult,modal=true
const fields=[{key:'sportsSalesEnabled'}]
const actions={fields,get:async()=>getResult,payload:(record,values,reason)=>{if(!record.canSave||!reason)throw Error('不可保存')},save:async()=>{saves++;if(saveError)throw saveError;return true}}
const load=Module._load
Module._load=function(name,parent,main){if(name==='../../../utils/boss/api')return{active:()=>{if(!current)throw Error('changed')}};if(name==='../../../utils/boss/business-settings')return actions;return load.call(this,name,parent,main)}
global.Page=value=>definition=value;global.wx={getStorageSync:()=>({accessToken:'synthetic'}),showModal:o=>o.success({confirm:modal})}
require('../pages/boss/business-settings/index');Module._load=load
function page(){const result={...definition,data:JSON.parse(JSON.stringify(definition.data)),setData(value){Object.assign(this.data,value)}};result.session={};result.version=0;return result}
async function run(){
 getResult={revision:'1',canSave:true,locked:false,reason:'',values:{sportsSalesEnabled:false}};const p=page();await p.load();assert.equal(p.data.fields[0].checked,false)
 p.change({currentTarget:{dataset:{key:'sportsSalesEnabled'}},detail:{value:true}});p.reason({detail:{value:'新门店设置'}})
 saveError=Object.assign(Error('版本已变化'),{code:10086});await p.submit();assert.equal(p.data.needsReload,true);assert.equal(p.data.fields[0].checked,true);assert.equal(p.data.reason,'新门店设置');await p.submit();assert.equal(saves,1)
 modal=false;await p.retry();assert.equal(p.data.needsReload,true);assert.equal(p.data.fields[0].checked,true)
 modal=true;await p.retry();assert.equal(p.data.needsReload,false);assert.equal(p.data.fields[0].checked,false)
 current=false;p.opened=true;p.onShow();assert.equal(p.data.record,null);assert.deepEqual(p.data.fields,[])
 current=true;let resolve;actions.get=()=>new Promise(r=>resolve=r);const late=page();const loading=late.load();late.onUnload();resolve(getResult);await loading;assert.equal(late.data.record,null)
 console.log('经营设置页面冲突保留输入、禁止重提、确认重读及会话切换/卸载检查通过')
}
run().catch(error=>{console.error(error);process.exitCode=1})
