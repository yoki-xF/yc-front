const assert=require('node:assert/strict'),api=require('../utils/admin-pay/adjustment')
const wallet={id:'9007199254740993',revision:'a'.repeat(64)}
const command=api.command(wallet,'12.34','decrease','合成原因','wallet_request_12345');assert.equal(command.delta,-1234);assert.equal(command.walletId,wallet.id);assert.ok(api.validPending(command,wallet.id));assert.ok(!api.validPending(command,'2'));assert.throws(()=>api.command(wallet,'0','increase','合成原因','wallet_request_12345'));assert.throws(()=>api.command(wallet,'1','invalid','合成原因','wallet_request_12345'));assert.throws(()=>api.receipt({walletId:'2',state:'APPLIED'},wallet.id))
let page,modal;const storage=new Map([['yc_session',{tenantId:'1',sessionKey:'first',accessToken:'private'}]])
global.Page=value=>{page=value};global.wx={getStorageSync:key=>storage.get(key),setStorageSync:(key,value)=>storage.set(key,value),removeStorageSync:key=>storage.delete(key),showModal:value=>{modal=value}}
require('../pages/admin-pay/wallet-adjustment/index')
const ctx={data:{enabled:true,busy:false,pending:null,amount:'1.00',direction:'increase',reason:'合成原因'},session:storage.get('yc_session'),walletId:wallet.id,storageKey:'private_pending',rawWallet:wallet,setData(value){Object.assign(this.data,value)}}
for(const key of Object.keys(page))if(typeof page[key]==='function')ctx[key]=page[key].bind(ctx)
let request
api.call=async(s,path,options)=>{request=options.data;assert.ok(storage.has(ctx.storageKey),'request must persist before dispatch');throw Error('synthetic network failure')}
;(async()=>{
 ctx.submit();await modal.success({confirm:true});assert.ok(ctx.data.pending);assert.equal(ctx.data.pending.requestKey,request.requestKey);assert.ok(storage.has(ctx.storageKey));assert.equal(ctx.data.busy,false)
 const original=request
 api.call=async(s,path,options)=>{assert.equal(options.data.requestKey,original.requestKey);return {id:'1',state:'APPLIED',walletId:wallet.id,delta:100,beforeBalance:1000,afterBalance:1100,afterTotalRecharge:1100,reason:'合成原因',transactionId:'9007199254740994'}}
 ctx.retry();await modal.success({confirm:true});assert.equal(ctx.data.pending,null);assert.equal(storage.has(ctx.storageKey),false);assert.equal(ctx.data.receipt.state,'APPLIED');assert.equal(ctx.data.receipt.after,'11.00')
 ctx.data.pending=original;ctx.data.enabled=true;storage.set(ctx.storageKey,original)
 api.call=async(s,path,options)=>{assert.match(path,/\/cancel$/);assert.equal(options.data.requestKey,original.requestKey);return {id:'2',state:'CANCELLED',walletId:wallet.id,delta:100,reason:'合成原因'}}
 ctx.cancel();await modal.success({confirm:true});assert.equal(ctx.data.receipt.state,'CANCELLED');assert.equal(storage.has(ctx.storageKey),false)
 storage.set('yc_session',{tenantId:'1',sessionKey:'second',accessToken:'other'});modal=null;ctx.data.enabled=true;ctx.submit();assert.equal(modal,null)
 console.log('Wallet adjustment exact amounts, persistent pending request, manual same-key retry and receipt cleanup pass')
})().catch(e=>{console.error(e);process.exitCode=1})
