const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path')
let definition,mode='closed',permissions=['sport:check-fund:query','sport:check-ggl:query']
const api={identity:async()=>({user:{id:1,nickname:'老板'},permissions}),capabilities:async()=>{if(mode==='offline')throw Error('offline');return {reportsEnabled:mode==='open',correctionsEnabled:false}}}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/boss/home/index.js'),'utf8'),{Page:p=>{definition=p},wx:{},require:n=>n.endsWith('/api')?api:n.endsWith('/admin-entries')?require('../utils/admin-entries'):require('../utils/boss/resources')})
async function run(){
 const page={...definition,data:{...definition.data},version:0,setData(p){Object.assign(this.data,p)}}
 await page.load();assert.equal(page.data.modules.length,2);assert.equal(page.data.reportAccess,false);assert.match(page.data.availabilityNotice,/验证后开放/)
 mode='offline';await page.load();assert.equal(page.data.modules.length,2);assert.equal(page.data.error,'');assert.equal(page.data.reportAccess,false)
 mode='open';await page.load();assert.equal(page.data.reportAccess,true)
 permissions=['sport:check-fund:query'];await page.load();assert.equal(page.data.reportAccess,false);assert.equal(page.data.availabilityNotice,'')
 console.log('报表开放状态与账号权限共同判断、状态读取失败不阻断普通管理检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
