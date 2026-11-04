const assert=require('node:assert/strict'),Module=require('node:module')
const old=Module._load, dayA='aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',dayB='bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb'
let current=dayA, delayed=null, count=0
const session={tenantId:'9',accessToken:'a',refreshToken:'r'},storage={yc_session:session}
global.wx={getStorageSync:k=>storage[k]}
Module._load=function(name,parent,...rest){if(name==='./request' && parent.filename.endsWith('/utils/operating-day.js'))return {sameSession:(a,b)=>!!a&&!!b&&a.refreshToken===b.refreshToken&&a.tenantId===b.tenantId,request:async(path,opts)=>{count++;if(delayed)await delayed;return {status:'OPEN',id:current,businessDate:'2026-11-02',deptId:opts.data.deptId,actorId:'9007199254740995'}}};return old.call(this,name,parent,...rest)}
const day=require('../utils/operating-day');Module._load=old
async function run(){
 const page={session,deptId:'9007199254740993',userId:'9007199254740995'}
 await day.bind(page,'draft');assert.equal(page.operatingDay.businessDate,'2026-11-02');assert.equal(day.header(page,{})['X-Operating-Day'],dayA);assert.ok(page.draftKey.includes('9007199254740995_9007199254740993_'+dayA))
 current=dayB;await day.bind(page,'draft');assert.equal(count,1);assert.equal(day.header(page,{})['X-Operating-Day'],dayA)
 const fresh={session,deptId:page.deptId,userId:page.userId};await day.bind(fresh,'draft');assert.notEqual(page.draftKey,fresh.draftKey);assert.equal(day.header(fresh,{})['X-Operating-Day'],dayB)
 page.deptId='2';assert.throws(()=>day.header(page,{}));page.deptId='9007199254740993';storage.yc_session={...session,refreshToken:'other'};assert.throws(()=>day.header(page,{}));storage.yc_session=session
 let release;delayed=new Promise(r=>release=r);const late={session,deptId:'1',userId:'1'}, pending=day.bind(late,'draft');late.deptId='2';release();await assert.rejects(pending);assert.equal(late.operatingDay,undefined)
 console.log('营业日快照、草稿隔离、长编号和迟到响应检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
