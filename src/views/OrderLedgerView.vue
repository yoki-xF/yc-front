<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { closeDialog, showConfirmDialog } from 'vant'
import { departments, identity, employeeScopeError, loadAccount } from '../api/account'
import { ApiError, request } from '../api/client'
import { session } from '../api/session'
import { employeeDay } from '../domain/employee-entry'
import { allowedActions, writeResult, requireEditorDay, createdLabel, checkedLines, choices, decimal, journalKey, ledgerId, lineTotal, readJournal, snapshot, snapshotLines, transitionPath, validateOriginal, verified, type Action, type Choice, type Direction, type Journal, type Line, type OrderType, type Snapshot } from '../domain/order-ledger'
const route=useRoute(), dept=ref(String(route.query.deptId||'')), type=ref<OrderType>('purchase'), direction=ref<Direction>('in')
const page=ref(1), total=ref(0), rows=ref<any[]>([]), detail=ref<Snapshot|null>(null), day=ref<{id:string;date:string}|null>(null)
const error=ref(''),notice=ref(''),busy=ref(false), reading=ref(false), editor=ref(false), original=ref<Snapshot|null>(null)
const lines=ref<Line[]>([]), remark=ref(''), source=ref(''), sources=ref<{id:string;name:string}[]>([]), materials=ref<Choice[]>([])
const editorDay=ref('')
const pending=ref<Journal|null>(null), createPending=ref<Journal|null>(null), storageError=ref(''), verifiedList=ref(false)
let epoch=0, detailEpoch=0, sourceEpoch=0, disposed=false
const context=computed(()=>[session.value?.key,session.value?.tenantId,identity.value?.user.id,dept.value,type.value,direction.value].join('|'))
const storeName=computed(()=>departments.value.find(d=>d.id===dept.value)?.name||dept.value)
const validScope=computed(()=>!!session.value&&!!identity.value&&!employeeScopeError.value&&departments.value.some(d=>d.id===dept.value))
const actions=computed(()=>detail.value?allowedActions(type.value,direction.value,detail.value.order):[])
const locked=computed(()=>busy.value||reading.value||!day.value||!validScope.value||!!pending.value||!!storageError.value)
const amount=computed(()=>{try{return lineTotal(lines.value)}catch{return '金额待核对'}})
function key(id='create'){return journalKey(session.value!.tenantId,identity.value!.user.id,dept.value,type.value,id)}
function current(e:number,c=context.value){return !disposed&&e===epoch&&c===context.value}
function message(e:unknown){return e instanceof Error?e.message:String(e)}
function refreshLocks(){
 pending.value=null;createPending.value=null;storageError.value=''
 if(!validScope.value)return
 try{createPending.value=readJournal(localStorage.getItem(key()));if(detail.value)pending.value=readJournal(localStorage.getItem(key(ledgerId(detail.value.order.id))))}
 catch(e){storageError.value=message(e)}
}
function invalidate(){epoch++;detailEpoch++;sourceEpoch++;closeDialog();day.value=null;detail.value=null;original.value=null;editor.value=false;editorDay.value='';lines.value=[];materials.value=[];sources.value=[];source.value='';rows.value=[];total.value=0;page.value=1;pending.value=null;createPending.value=null;verifiedList.value=false;reading.value=false;error.value='';notice.value='';refreshLocks()}
watch(context,()=>{invalidate();if(validScope.value)void load()}, {flush:'sync'})
function storageChanged(event:StorageEvent){if(event.key?.startsWith('yc-order-unknown-v1:'))refreshLocks()}
window.addEventListener('storage',storageChanged)
onUnmounted(()=>{disposed=true;epoch++;closeDialog();window.removeEventListener('storage',storageChanged)})
async function readDay(e:number){
 day.value=null
 const raw=await request('/sport/wx/store/operating-day',{data:{deptId:dept.value}})
 if(!current(e))throw Error('门店或账号已变化')
 if(raw?.status==='NOT_OPEN'){day.value=null;return null}
 const d=employeeDay(raw,dept.value,identity.value!.user.id);if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(d.id))throw Error('营业日UUID无效');day.value=d;return d
}
async function load(){
 if(!validScope.value||reading.value)return
 const e=epoch;reading.value=true;error.value=''
 try{
  // Historical lists do not require an open day. A failed day read never authorizes writes.
  try{await readDay(e)}catch(err){if(current(e)){day.value=null;error.value=message(err)}}
  if(!current(e))return
  const raw=await request('/sport/wx/order-ledger/page',{data:{deptId:dept.value,type:type.value,direction:direction.value,pageNo:page.value,pageSize:20}})
  if(!current(e))return
  if(!Array.isArray(raw?.list)||!Number.isSafeInteger(raw.total)||raw.total<0)throw Error('列表分页数据无效')
  for(const row of raw.list)ledgerId(row.id)
  rows.value=raw.list;total.value=raw.total;verifiedList.value=true;refreshLocks()
 }catch(err){if(current(e))error.value=message(err)}finally{if(current(e))reading.value=false}
}
async function open(id:string){
 if(reading.value||busy.value)return
 const e=epoch,n=++detailEpoch;reading.value=true;error.value='';editor.value=false
 try{
  const d=await readDay(e);if(!current(e))return
  const raw=await request('/sport/wx/order-ledger/detail',{data:{deptId:dept.value,type:type.value,id:ledgerId(id)},operatingDay:d?.id})
  if(!current(e)||n!==detailEpoch)return
  if(ledgerId(raw?.order?.id)!==ledgerId(id))throw Error('单据编号与请求不一致')
  detail.value=snapshot(raw,type.value,dept.value,direction.value);refreshLocks()
 }catch(err){if(current(e))error.value=message(err)}finally{if(current(e))reading.value=false}
}
async function getChoices(e:number,d:string,selectedSource:string){
 if(type.value==='purchase')return choices(await request('/sport/wx/common/material/List'))
 const raw=await request<any[]>('/sport/wx/order-ledger/transfer/sources',{data:{deptId:dept.value},operatingDay:d})
 if(!current(e))throw Error('门店已变化')
 if(!Array.isArray(raw))throw Error('源店选项无效')
 const list=raw.map(s=>({id:ledgerId(s.id),name:String(s.name)}));sources.value=list
 if(!selectedSource)return []
 if(!list.some(s=>s.id===selectedSource))throw Error('源店已停用或不可选，请联系管理员')
 return choices(await request('/sport/wx/order-ledger/transfer/source-inventory',{data:{deptId:dept.value,sourceDeptId:selectedSource},operatingDay:d}),true)
}
async function begin(edit=false){
 if(locked.value||(!edit&&createPending.value))return
 const e=epoch;reading.value=true;error.value=''
 try{
  const d=await readDay(e);if(!d)throw Error('门店尚未开店，只能查看历史记录')
  const s=edit?detail.value:null
  if(edit&&(!s||!allowedActions(type.value,direction.value,s.order).includes('edit')))throw Error('当前单据不可编辑')
  const draft=s?validateOriginal(s):[]
  const src=s&&type.value==='transfer'?ledgerId(s.order.exDeptId):''
  const options=await getChoices(e,d.id,src)
  if(!current(e))return
  editorDay.value=d.id;original.value=s;lines.value=draft;remark.value=String(s?(s.order.remark??s.items[0]?.remark??''):'');source.value=src;materials.value=options;editor.value=true
 }catch(err){if(current(e))error.value=message(err)}finally{if(current(e))reading.value=false}
}
async function changeSource(){
 const e=epoch,n=++sourceEpoch,src=source.value;materials.value=[];lines.value=[];reading.value=true
 try{const d=await readDay(e);if(!d)throw Error('门店尚未开店');requireEditorDay(editorDay.value,d.id);const options=await getChoices(e,d.id,src);if(current(e)&&n===sourceEpoch&&src===source.value)materials.value=options}
 catch(err){if(current(e)&&n===sourceEpoch)error.value=message(err)}finally{if(current(e)&&n===sourceEpoch)reading.value=false}
}
function add(){if(lines.value.length<100)lines.value.push({materialId:'',packageNum:'0',sheetNum:'0',expectedPrice:'',expectedMoney:''})}
function choose(line:Line){const m=materials.value.find(m=>m.id===line.materialId);line.expectedPrice=m?.price||'';line.expectedMoney=m?.money||''}
function displayMoney(v:unknown){try{return decimal(v)}catch{return '金额精度不安全（只读）'}}
async function submit(action:'create'|Action){
 if(locked.value||((action==='create')&&createPending.value))return
 const e=epoch,c=context.value,s=action==='create'?null:action==='edit'?original.value:detail.value
 let succeeded=false,writeKey='',writeJournal='',createdId:string|null=null
 busy.value=true;error.value='';notice.value=''
 try{
  const d=await readDay(e);if(!d)throw Error('当前门店未开店，禁止写入')
  if(!current(e,c))return
  let payload:Record<string,unknown>, summary:string
  if(action==='create'||action==='edit'){
   requireEditorDay(editorDay.value,d.id)
   if(action==='edit'&&(!s||!allowedActions(type.value,direction.value,s.order).includes('edit')))throw Error('当前单据不可编辑')
   if(type.value==='transfer'&&direction.value!=='in')throw Error('调出方只能确认')
   if(remark.value.length>255)throw Error('备注不能超过255字')
   const fresh=await getChoices(e,d.id,source.value);if(!current(e,c))return
   const items=checkedLines(lines.value,fresh)
   payload={deptId:dept.value,remark:remark.value,items,...(s?{id:ledgerId(s.order.id),revision:s.revision}:{}),...(type.value==='transfer'?{sourceDeptId:ledgerId(source.value)}:{})}
   summary=`${items.reduce((n,l)=>n+l.packageNum,0)}包 / ${items.reduce((n,l)=>n+l.sheetNum,0)}张，金额 ${lineTotal(lines.value)}元`
  }else{
   if(!s||!allowedActions(type.value,direction.value,s.order).includes(action))throw Error('当前方向或状态不可操作')
   const ls=validateOriginal(s)
   // Validate the catalogue/source price against the original snapshot before confirmation.
   if(action==='confirm'&&type.value==='purchase'){
    const opts=choices(await request('/sport/wx/common/material/List'))
    checkedLines(ls,opts)
   }
   payload={deptId:dept.value,id:ledgerId(s.order.id),revision:s.revision}
   summary=`${s.order.totalPackageNum}包 / ${s.order.totalSheetNum}张，金额 ${decimal(s.order.totalAmount)}元`
  }
  if(!current(e,c))return
  const label=action==='create'?'创建':action==='edit'?'保存修改':action==='cancel'?'取消单据':type.value==='purchase'?'确认入库':'确认调出'
  const originalText=s?`原单 ${s.order.orderNo}（${s.order.id}）\n原数量 ${s.order.totalPackageNum}包 / ${s.order.totalSheetNum}张，原金额 ${displayMoney(s.order.totalAmount)}元\n`:'新单据\n'
  await showConfirmDialog({title:label,message:`门店：${storeName.value}\n营业日：${d.date}\n${originalText}本次：${label}\n${summary}\n${type.value==='transfer'?`调出：${s?.order.exDeptName||sources.value.find(x=>x.id===source.value)?.name||source.value}\n调入：${s?.order.deptName||storeName.value}\n`:''}确认后请核对库存和结店预检；晚盘后变动可能需要重新盘点。`})
  if(!current(e,c))return
  const freshDay=await readDay(e);if(!freshDay||freshDay.id!==d.id)throw Error('营业日已变化，请重新读取核对')
  if(s){const reread=snapshot(await request('/sport/wx/order-ledger/detail',{data:{deptId:dept.value,type:type.value,id:s.order.id},operatingDay:d.id}),type.value,dept.value,direction.value);if(reread.revision!==s.revision)throw Error('单据已变化，已保留输入。请另行打开最新详情核对，禁止自动重试')}
  if(!current(e,c))return
  const storageKey=key(s?ledgerId(s.order.id):'create');writeKey=storageKey
  if(localStorage.getItem(storageKey)!==null)throw Error('存在尚未核对的提交，请先核对结果')
  const journal:Journal={action,day:d.id,revision:s?.revision,payload,sentAt:new Date().toISOString()}
  writeJournal=JSON.stringify(journal)
  localStorage.setItem(storageKey,writeJournal);verifiedList.value=false;refreshLocks()
  const path=action==='confirm'||action==='cancel'?transitionPath(type.value,action,dept.value,ledgerId(s!.order.id),s!.revision):`/sport/wx/order-ledger/${type.value}/${action}`
  const receipt=await request(path,{method:'POST',data:action==='confirm'||action==='cancel'?undefined:payload,operatingDay:d.id})
  createdId=writeResult(action,receipt)
  // Clear the captured scope only after a definite success, even if the user switched away.
  if(localStorage.getItem(storageKey)===writeJournal)localStorage.removeItem(storageKey)
  if(!current(e,c))return
  succeeded=true;refreshLocks();editor.value=false;notice.value='操作已成功。请刷新库存与结店预检，必要时重新晚盘；未自动生成最终日报。'
 }catch(err){if(current(e,c)&&err!=='cancel'&&err!=='close'){error.value=message(err)
   if(writeKey&&err instanceof ApiError&&[400,403,10086].includes(err.code||0)){
    try{if(localStorage.getItem(writeKey)===writeJournal)localStorage.removeItem(writeKey)}catch{storageError.value='无法清理明确失败的请求，请核对浏览器存储'}
   }
   refreshLocks()}}
 finally{if(current(e,c)){busy.value=false;if(succeeded)await load();if(createdId&&succeeded)await open(createdId);else if((pending.value||succeeded)&&detail.value){const id=ledgerId(detail.value.order.id);await open(id)}}else busy.value=false}
}
async function acknowledge(existing=false){
 const j=existing?pending.value:createPending.value,s=detail.value
 if(!j||busy.value||reading.value)return
 const e=epoch,c=context.value
 try{
  if(existing){if(!s||!verified(j,s))throw Error('重读记录尚未证实状态变化，继续锁定；请联系管理员核查，不可重放')}
  else if(!verifiedList.value)throw Error('请先重新读取列表并逐页核对')
  const storageKey=key(existing?ledgerId(s!.order.id):'create'),saved=localStorage.getItem(storageKey)
  if(saved!==JSON.stringify(j))throw Error('待核对请求已变化，请重新读取核对')
  await showConfirmDialog({title:'人工核对提交结果',message:existing?`门店 ${storeName.value}，原请求 ${j.action}；已重读单据 ${s!.order.orderNo}，请核对当前内容和原请求。解除锁不会重放请求。`:`门店 ${storeName.value}：请检查所有相关历史页及单据详情，确认 ${j.sentAt} 的创建结果，避免重复建单。解除锁后也不会自动重放。`,confirmButtonText:'我已核对结果'})
  if(!current(e,c))return
  if(localStorage.getItem(storageKey)!==saved)throw Error('待核对请求已被其他页面更新，请重新读取核对')
  localStorage.removeItem(storageKey);refreshLocks()
 }catch(err){if(current(e,c)&&err!=='cancel'&&err!=='close')error.value=message(err)}
}
async function initialize(){const login=session.value?.key;try{await loadAccount();if(disposed||login!==session.value?.key)return;if(employeeScopeError.value)throw Error(employeeScopeError.value);if(!departments.value.some(d=>d.id===dept.value))dept.value=departments.value[0]?.id||'';if(validScope.value)await load()}catch(err){error.value=message(err)}}
onMounted(initialize)
</script>
<template>
 <div class="page-title"><p class="eyebrow">ORDER LEDGER / 员工单据</p><h1>订票与库存调拨</h1><p class="intro">按员工门店查看历史单据；订票和调拨仅办理库存，不代表付款。</p></div>
 <section class="card filters"><label>员工门店<select v-model="dept"><option v-for="d in departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><label>单据类型<select v-model="type"><option value="purchase">订票</option><option value="transfer">调拨</option></select></label><label v-if="type==='transfer'">方向<select v-model="direction"><option value="in">调入</option><option value="out">调出</option></select></label><van-button :disabled="reading||busy" @click="load">刷新列表及营业日</van-button></section>
 <van-empty v-if="!departments.length&&!reading" description="暂无员工门店授权，请联系管理员"/><section v-if="error||storageError" class="card error" role="alert">{{error}} {{storageError}}</section><section v-if="notice" class="card success" role="status">{{notice}}</section>
 <van-notice-bar wrapable :text="day?`当前营业日 ${day.date}；所有日期待确认单均可能阻塞结店。`:'当前无有效开店上下文，仅可查询历史；刷新营业日后再办理。'" />
 <section v-if="createPending" class="card"><h2>创建结果未知，已禁止重复创建</h2><p>请刷新列表，逐页打开详情核对。原请求时间：{{createPending.sentAt}}</p><details><summary>查看原提交内容</summary><pre>{{JSON.stringify(createPending.payload,null,2)}}</pre></details><van-button :disabled="!verifiedList||busy||reading" @click="acknowledge(false)">已查列表，人工核对结果</van-button></section>
 <van-button v-if="type==='purchase'||direction==='in'" type="primary" block :disabled="locked||!!createPending" @click="begin(false)">新建{{type==='purchase'?'订票':'调入申请'}}</van-button>
 <section class="card"><h2>历史单据</h2><van-loading v-if="reading" /><van-empty v-if="!reading&&!rows.length" description="当前页暂无单据" /><button v-for="row in rows" :key="row.id" class="ledger-row" :disabled="busy||reading" @click="open(ledgerId(row.id))"><strong>{{row.orderNo||row.id}}</strong><span>{{['待确认','已确认','已取消'][Number(row.stat)]||'未知状态'}} · {{displayMoney(row.totalAmount)}}元</span><span>{{row.totalPackageNum}}包 / {{row.totalSheetNum}}张 · {{row.userName}}</span><span>创建时间（北京时间）：{{createdLabel(row.createTime)}}</span></button><div class="ledger-actions"><van-button :disabled="page<=1||reading||busy" @click="page--;load()">上一页</van-button><span>第{{page}}页 / 共{{total}}笔</span><van-button :disabled="page*20>=total||page>=100000||reading||busy" @click="page++;load()">下一页</van-button></div></section>
 <section v-if="detail" class="card"><h2>单据详情 · {{detail.order.orderNo}}</h2><p>创建时间（北京时间）：{{createdLabel(detail.order.createTime)}}</p><p>编号 {{detail.order.id}} · {{detail.order.deptName}} <template v-if="type==='transfer'">← {{detail.order.exDeptName}}</template></p><p>{{detail.order.totalPackageNum}}包 / {{detail.order.totalSheetNum}}张 · {{displayMoney(detail.order.totalAmount)}}元</p><p>状态：{{['待确认','已确认','已取消'][Number(detail.order.stat)]||'未知'}} · 经办 {{detail.order.userName}}</p><p v-if="type==='transfer'&&!/^T[0-9a-f]{32}$/.test(detail.order.orderNo)">历史调拨单只读，请联系管理员处理。</p><ul><li v-for="i in detail.items" :key="i.id">{{i.materialName}}：{{i.packageNum}}包 / {{i.sheetNum}}张；包价{{displayMoney(i.price)}}元，张价{{displayMoney(i.money)}}元 <span v-if="i.remark"> · {{i.remark}}</span></li></ul><p v-if="detail.order.remark">备注：{{detail.order.remark}}</p><van-button :disabled="reading||busy" @click="open(ledgerId(detail.order.id))">重读此单</van-button><template v-if="pending"><p class="error">上次{{pending.action}}结果未核对，操作持续锁定。请重读后核对，状态未证实变化不能解锁。</p><details><summary>原请求</summary><pre>{{JSON.stringify(pending.payload,null,2)}}</pre></details><van-button :disabled="busy||reading" @click="acknowledge(true)">核对服务器结果</van-button></template><div class="ledger-actions"><van-button v-for="a in actions" :key="a" :disabled="locked" :type="a==='confirm'?'primary':'default'" @click="a==='edit'?begin(true):submit(a)">{{a==='edit'?'编辑':a==='cancel'?'取消单据':type==='purchase'?'确认入库':'确认调出'}}</van-button></div></section>
 <form v-if="editor" class="card" @submit.prevent="submit(original?'edit':'create')"><h2>{{original?'编辑原单 '+original.order.orderNo:'创建新单'}}</h2><p class="intro">编辑失败保留输入及原版本。价格变化时请重新选择票种；源库存不预占。</p><label v-if="type==='transfer'" class="ledger-field">调出门店<select v-model="source" :disabled="!!original||busy||reading" @change="changeSource"><option value="">请选择服务器提供的源店</option><option v-for="s in sources" :key="s.id" :value="s.id">{{s.name}}</option></select></label><p v-if="type==='transfer'&&!sources.length&&!reading" class="intro">暂无可选调出门店，请联系管理员核对同组织门店是否已启用并完成初始化。</p><fieldset v-for="(line,index) in lines" :key="index" :disabled="busy||reading"><legend>票种 {{index+1}}</legend><label class="ledger-field">票种<select v-model="line.materialId" @change="choose(line)"><option value="">请选择</option><option v-for="m in materials" :key="m.id" :value="m.id">{{m.name}} · 包{{m.price}} / 张{{m.money}}元{{m.packageNum!=null?` · 库存${m.packageNum}包/${m.sheetNum}张`:''}}</option></select></label><div class="ledger-quantities"><label>包数<input v-model="line.packageNum" inputmode="numeric" maxlength="7"></label><label>散张数<input v-model="line.sheetNum" inputmode="numeric" maxlength="7"></label></div><p>所选价格：包{{line.expectedPrice||'待选'}}元 / 张{{line.expectedMoney||'待选'}}元</p><van-button size="small" @click="lines.splice(index,1)">移除此行</van-button></fieldset><van-button :disabled="locked||lines.length>=100||!materials.length" @click="add">添加票种（最多100行）</van-button><label class="ledger-field">备注<textarea v-model="remark" maxlength="255" :disabled="busy||reading" /></label><p>合计 {{amount}}元</p><van-button native-type="submit" type="primary" block :disabled="locked||(!original&&!!createPending)">核对并{{original?'保存修改':'创建'}}</van-button><van-button :disabled="busy" block @click="editor=false">收起表单</van-button></form>
</template>
<style scoped>
.ledger-row{display:flex;flex-direction:column;gap:8px;width:100%;padding:16px 0;background:none;border:0;border-bottom:1px solid #e5e7eb;text-align:left;color:inherit;overflow-wrap:anywhere;font:inherit}.ledger-row:disabled{opacity:.6}.ledger-actions{display:flex;align-items:center;flex-wrap:wrap;gap:10px;margin-top:16px}.ledger-field{display:flex;flex-direction:column;gap:8px;margin:16px 0}.ledger-field select,.ledger-field textarea,input{box-sizing:border-box;width:100%;min-height:44px;padding:10px;font:inherit;border:1px solid #cbd5e1;border-radius:8px;background:white;color:#16263b}.ledger-quantities{display:grid;grid-template-columns:1fr 1fr;gap:12px}fieldset{min-width:0;margin:16px 0;border:1px solid #cbd5e1;border-radius:10px;padding:12px}pre{white-space:pre-wrap;overflow-wrap:anywhere;font-size:13px}li{margin:12px 0;overflow-wrap:anywhere}h2,p{overflow-wrap:anywhere}form{margin-top:16px;padding-bottom:calc(24px + env(safe-area-inset-bottom))}
</style>
