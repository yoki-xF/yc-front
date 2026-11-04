const assert=require('node:assert/strict')
let session={tenantId:'1',accessToken:'token',sessionKey:'first'}
global.wx={getStorageSync:()=>session}
const api=require('./goview')
assert.throws(()=>api.parse('[]'),/对象/)
assert.throws(()=>api.parse(JSON.stringify({text:'中'.repeat(400000)})),/1MB/)
assert.throws(()=>api.parse('{"componentList":{}}'),/数组/)
assert.throws(()=>api.parse('{"componentList":'+JSON.stringify(Array(501).fill({}))+'}'),/500/)
const value=api.form({id:'9007199254740993',revision:'version',name:'A',status:1,content:'{"componentList":[]}'});assert.equal(api.payload(value).id,'9007199254740993');assert.equal(api.payload(value).status,1)
assert.throws(()=>api.form({id:9007199254740992,revision:'x'}),/精度/)
const text=JSON.stringify({componentList:[{chartConfig:{title:'文本'},attr:{x:0,y:10,w:100,h:50},option:{dataset:'javascript:bad'}},null]});assert.equal(api.summaries(text)[0].position,'x: 0 · y: 10 · w: 100 · h: 50');assert.equal(api.summaries(text)[1].title,'无法识别的组件')
const original=session;session={...session,accessToken:'rotated'};assert.equal(api.active(original).accessToken,'rotated');session={...session,sessionKey:'second'};assert.throws(()=>api.active(original),/账号/)
console.log('GoView JSON bounds, exact identifiers, component summaries and login boundary pass')
