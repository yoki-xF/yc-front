const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const root=path.join(__dirname,'..'),{entries,visible}=require('../utils/admin-entries')
assert.equal(visible({permissions:[],roles:[]}).length,0)
const store=visible({permissions:['system:dept:query','system:menu:query'],roles:['tenant_admin']})
assert.equal(store.length,1);assert.equal(store[0].permission,'system:dept:query')
assert.ok(visible({permissions:['system:menu:query'],roles:['super_admin']}).some(e=>e.title==='菜单管理'))
const routes=new Set(JSON.parse(fs.readFileSync(path.join(root,'app.json'))).pages)
for(const entry of entries){const route=entry.url.split('?')[0].slice(1);assert.ok(routes.has(route),entry.url);for(const ext of ['js','json','wxml'])assert.ok(fs.existsSync(path.join(root,route+'.'+ext)),route+'.'+ext)}
for(const group of ['admin-business','admin-system','admin-ledger','admin','admin-pay','admin-messaging']){
 const dir=path.join(root,'pages',group)
 for(const p of fs.readdirSync(dir,{recursive:true}).filter(p=>p.endsWith('.wxml'))){const s=fs.readFileSync(path.join(dir,p),'utf8');assert.ok(!/wx:(if|elif)="(?!\{\{)/.test(s),'条件必须绑定表达式: '+p)}
}
const {initial,payload}=require('../utils/admin-business/model')
assert.equal(initial('departments',{parentId:'0'}).parentId,'')
const v=initial('activities',{salesName:'A',salesCode:'a',startTime:'2026-11-01T09:00',endTime:'2026-11-01T10:00',deptIds:'10',salesMoney:'1.20',stat:0})
assert.equal(payload('activities',v,[{id:'10'}]).startTime,'2026-11-01 09:00:00')
console.log('Admin integration: permission/role entry gates, registered page files, bound WXML conditions and backend date roundtrip pass')
