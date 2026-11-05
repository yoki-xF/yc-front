const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path')
const root=path.join(__dirname,'..'),routes=JSON.parse(fs.readFileSync(path.join(root,'app.json'))).pages
const {entries,visible}=require('../utils/admin-entries'),messages=require('../utils/admin-messaging/model')
for(const prefix of ['pages/admin-infra/','pages/admin-report/','pages/admin-messaging/area/']){
 assert.ok(!routes.some(route=>route.startsWith(prefix)),prefix)
 assert.ok(!entries.some(entry=>entry.url.startsWith('/'+prefix)),prefix)
}
for(const key of ['oauth-clients','oauth-tokens'])assert.throws(()=>messages.resource(key),/不支持/)
for(const route of ['pages/activity/index','pages/boss/commission-create/index','pages/boss/schedule/index','pages/boss/reports/index','pages/report/index','pages/admin-messaging/inbox/index','pages/boss/business-settings/index'])assert.ok(routes.includes(route),route)
const actual=visible({user:{id:'1'},permissions:['*:*:*'],roles:['super_admin']})
assert.ok(actual.some(entry=>entry.key==='messages:notify-templates'))
for(const entry of entries)assert.ok(routes.includes(entry.url.split('?')[0].slice(1)),entry.url)
// The shared export byte bound remains correct after removing the tool directory.
const {utf8Bytes}=require('../utils/json-size');assert.equal(utf8Bytes('A中文😀'),11)
console.log('Retired developer routes are absent; promotions, commissions, schedules, business reports, notifications and exports remain')
