const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path')
const correction=require('../utils/boss/corrections')
const record={id:'21',revision:'a'.repeat(64),classes:'Late',xj:'400.00',actorId:'11',canCorrect:true}
assert.throws(()=>correction.command('funds',record,{xj:'410.001'},[],'更正盘点记录原因'),/两位/)
assert.throws(()=>correction.command('funds',record,{xj:''},[],'更正盘点记录原因'),/清零/)
assert.throws(()=>correction.command('funds',record,{xj:'410'},[],'原因'),/5至/)
const cmd=correction.command('funds',record,{xj:'410',deptId:'999',funds:'10000'},[],'更正现金录入错误')
assert.deepEqual(cmd.fields,{xj:'410'})
assert.equal(correction.definitions('inventory',{classes:'Late',remark:'',morningCashDesc:'100'}).some(x=>x.key==='morningCashDesc'),false)
assert.deepEqual(correction.reports({instantSales:'100.00'},{instantSales:'90.00'}),[{name:'即开销量',before:'100.00',after:'90.00'}])
assert.deepEqual(correction.reports({sportsBettingSales:'1.00',wrongTicket:'999.00'},{sportsBettingSales:'2.00',wrongTicket:'999.00'}),[{name:'竞彩销量',before:'1.00',after:'2.00'},{name:'错票（单列）',before:'999.00',after:'999.00'}])
assert.equal(correction.definitions('inventory',{classes:'Morning',remark:'',morningCashDesc:'100'}).some(x=>x.key==='morningCashDesc'),false)
let definition,current={tenantId:1,accessToken:'a',refreshToken:'r'},attempts=[],fail=true;const storage=new Map()
const api={active(s){if(s!==current)throw Error('账号已变化')},correctionApply:async(_s,c)=>{attempts.push(structuredClone(c));if(fail){const e=Error('timeout');e.mayHaveWritten=true;throw e}return{status:'APPLIED',auditId:'audit-1',impacts:[]}},correctionHistory:async()=>[]}
const context={Page:x=>definition=x,wx:{getStorageSync:key=>key==='yc_session'?current:storage.get(key),setStorageSync:(k,v)=>storage.set(k,structuredClone(v)),removeStorageSync:k=>storage.delete(k),showModal:o=>o.success({confirm:true})},require:name=>name.endsWith('/api')?api:correction}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/boss/correction/index.js'),'utf8'),context)
async function run(){const page={...definition,session:current,type:'funds',id:'21',record,key:'draft-key',version:1,data:{...structuredClone(definition.data),loading:false,canCorrect:true,values:{xj:'410'},reason:'更正现金录入错误',preview:{changes:[]}},setData(update){Object.assign(this.data,update)}};page.previewCommand=cmd
 await page.submit();assert.equal(page.data.pending,true);assert.equal(page.data.saved,false);assert.equal(storage.get('draft-key').pendingCommand.requestKey,attempts[0].requestKey)
 fail=false;await page.sendPending();assert.equal(attempts[0].requestKey,attempts[1].requestKey);assert.equal(page.data.saved,true);assert.equal(storage.has('draft-key'),false)
 const full={...definition,session:current,type:'funds',id:'21',record,key:'full-key',version:1,previewCommand:cmd,data:{...structuredClone(definition.data),loading:false,canCorrect:true,values:{xj:'410'},reason:'更正现金录入错误',preview:{changes:[]}},setData(update){Object.assign(this.data,update)}}
 const save=context.wx.setStorageSync;context.wx.setStorageSync=()=>{throw Error('storage full')};await full.submit();assert.equal(attempts.length,2);assert.equal(full.data.pending,false);assert.match(full.data.error,/尚未提交/);context.wx.setStorageSync=save
 page.opened=true;current={tenantId:2,accessToken:'b',refreshToken:'r2'};page.onShow();assert.equal(Object.keys(page.data.values).length,0);assert.equal(page.data.history.length,0)
 api.correctionRecord=async()=>({...record,revision:undefined,canCorrect:false,correctionHistoryAvailable:false,correctionBlockedReason:'暂未开放'})
 api.correctionHistory=async()=>{throw Error('关闭时不应访问审计接口')}
 const closed={...definition,session:current,type:'funds',id:'21',version:0,data:structuredClone(definition.data),setData(update){Object.assign(this.data,update)}}
 const draftKey='yc_boss_correction_2_11_funds_21';storage.set(draftKey,{pendingCommand:cmd,values:{xj:'999'}})
 await closed.load();assert.equal(closed.data.error,'');assert.equal(closed.data.canCorrect,false);assert.equal(closed.data.pending,false);assert.equal(closed.data.values.xj,'400.00');assert.equal(storage.has(draftKey),true)
 console.log('更正输入白名单、精度、超时同请求重试及跨账号页面清理检查通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
