const assert=require('node:assert/strict'),{visible}=require('../utils/admin-entries'),scope=require('../utils/migration-scope')
const entries=visible({user:{id:'1'},permissions:['*:*:*'],roles:['super_admin']})
assert.ok(!entries.some(scope.deferredEntry))
assert.ok(entries.some(e=>e.key==='messages:notify-templates'))
assert.ok(!entries.some(e=>e.key==='messages:oauth-clients'))
assert.ok(!entries.some(e=>e.key==='infra:server'))
let called=0,data;global.Page=page=>{global.page=page};global.wx={getStorageSync:()=>{called++;throw Error('deferred payment must not read session or call API')}}
require('../pages/admin-pay/app/index');global.page.onLoad.call({setData:value=>{data=value}},{});assert.equal(data.deferred,true);assert.equal(called,0)
console.log('Deferred external integration entries and direct payment routes are blocked; internal management remains available')
