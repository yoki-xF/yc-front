const assert=require('node:assert/strict')
const vm=require('node:vm'),fs=require('node:fs'),path=require('node:path')
let definition,confirm,modalCount=0,savedValues
const api={active(){return {}},save:async(_s,_key,values)=>{savedValues=values;return 7}}
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../pages/boss/form/index.js'),'utf8'),{
  Page:p=>{definition=p},wx:{showModal(o){modalCount++;confirm=o.success}},
  require:name=>name.endsWith('/api')?api:name.endsWith('/forms')?require('../utils/boss/forms'):require('../utils/boss/resources')
})
async function run(){
  const page={...definition,data:{...definition.data,loading:false,values:{materialName:'原名称',brandName:'品牌',money:'20',price:'600',num:'30'}},type:'materials',original:{},departments:[],current:()=>true,setData(update){Object.assign(this.data,update)}}
  const first=page.submit();assert.equal(page.data.busy,true)
  await page.submit();assert.equal(modalCount,1)
  page.data.values.materialName='确认期间的新名称'
  confirm({confirm:true});await first
  assert.equal(savedValues.materialName,'原名称');assert.equal(page.data.saved,true);assert.equal(page.data.busy,false)
  savedValues=undefined
  const leaving={...definition,data:{...definition.data,loading:false,values:{materialName:'票种',brandName:'品牌',money:'20',price:'600',num:'30'}},version:0,type:'materials',original:{},departments:[],setData(update){Object.assign(this.data,update)}}
  const pending=leaving.submit();leaving.onUnload();confirm({confirm:true});await pending
  assert.equal(savedValues,undefined);assert.equal(leaving.data.saved,false)
  console.log('表单确认期间重复点击阻断、保存内容冻结和成功状态检查通过')
}
run().catch(e=>{console.error(e);process.exitCode=1})
