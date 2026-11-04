const assert=require('node:assert/strict'),Module=require('node:module')
const a='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',b='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';let current=a, writes=0, definition
const session={tenantId:'1',accessToken:'a',refreshToken:'r'},storage={yc_session:session}
global.wx={getStorageSync:k=>storage[k],setStorageSync:(k,v)=>{storage[k]=structuredClone(v)},removeStorageSync:k=>delete storage[k],showToast(){},showModal:o=>o.success({confirm:true})};global.Page=p=>definition=p
const api={sameSession:(x,y)=>!!x&&!!y&&x.tenantId===y.tenantId&&x.refreshToken===y.refreshToken,request:async(path,opts)=>{
 if(path.endsWith('/store/operating-day'))return {status:'OPEN',id:current,businessDate:'2026-11-02',deptId:opts.data.deptId,actorId:'9007199254740993'}
 if(path.endsWith('/fund/safe-item')){if(opts.header['X-Operating-Day']!==current){let e=Error('营业日已变化');e.code=10086;throw e}return {revision:'v1',record:{xj:1,wxBalance:2,hsk:3,zfb:4,szRmb:5}}}
 if(path.endsWith('/fund/safe-submit')){writes++;if(opts.header['X-Operating-Day']!==current){let e=Error('营业日已变化');e.code=10086;throw e}return true}
}}
const old=Module._load;Module._load=function(n,parent,...rest){if(n==='../../utils/request'||(n==='./request'&&parent.filename.endsWith('/utils/operating-day.js')))return api;return old.call(this,n,parent,...rest)};require('../pages/fund/index');Module._load=old
const make=()=>Object.assign({},definition,{data:structuredClone(definition.data),setData(o){Object.assign(this.data,o)}}),tick=()=>new Promise(r=>setImmediate(r))
async function run(){const p=make();p.onLoad({deptId:'10',userId:'9007199254740992'});await tick();assert.ok(p.draftKey.includes('9007199254740993'));p.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'7'}});await p.submit();assert.equal(writes,1);p.input({currentTarget:{dataset:{field:'xj'}},detail:{value:'8'}});const oldKey=p.draftKey;current=b;await p.submit();assert.equal(writes,2);assert.equal(storage[oldKey].xj,'8');assert.match(p.data.error,/营业日已变化/);const next=make();next.onLoad({deptId:'10',userId:'9007199254740992'});await tick();assert.notEqual(next.draftKey,oldKey);assert.equal(next.data.xj,'1');assert.equal(storage[oldKey].xj,'8');console.log('实际资金表单绑定与旧营业日拒绝检查通过')}
run().catch(e=>{console.error(e);process.exitCode=1})
