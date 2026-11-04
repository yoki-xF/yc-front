const assert=require('node:assert/strict')
const session={tenantId:'1',sessionKey:'first',accessToken:'token'};let modal
const {submit}=require('../utils/admin-system/removal')
global.wx={getStorageSync:()=>session,showModal:v=>{modal=v}}
const context={data:{canRemove:true},session,current:()=>true,setData(value){Object.assign(this.data,value)}}
;(async()=>{const promise=submit(context,'posts',{id:'9007199254740993',revision:'v'});assert.equal(context.data.busy,true);assert.match(modal.content,/9007199254740993/);modal.success({confirm:false});await promise;assert.equal(context.data.busy,false);modal=null;context.data.canRemove=false;await submit(context,'posts',{id:'1',revision:'v'});assert.equal(modal,null);console.log('Admin removal requires permission, retains exact IDs and handles cancelled confirmation')})().catch(e=>{console.error(e);process.exitCode=1})
