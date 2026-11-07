<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {closeDialog,showConfirmDialog} from 'vant'
import {departments,employeeScopeError,identity,loadAccount} from '../api/account'
import {ApiError,request} from '../api/client'
import {session} from '../api/session'
import {employeeDay} from '../domain/employee-entry'
import {createdLabel} from '../domain/order-ledger'
import {cashCommand,cashJournalKey,cashJournals,cashOutcome,cashPage,cashPayload,requireCashDay,type CashJournal,type CashRow,type CashScope} from '../domain/cash-ledger'
const route=useRoute(),dept=ref(String(route.query.deptId||'')),rows=ref<CashRow[]>([]),page=ref(1),total=ref(0)
const day=ref<{id:string;date:string}|null>(null),draftDay=ref<{id:string;date:string}|null>(null),amount=ref(''),remark=ref('')
const journals=ref<CashJournal[]>([]),pending=computed(()=>journals.value[0]||null),busy=ref(false),loading=ref(false),error=ref(''),notice=ref(''),storageError=ref('')
const scope=computed<CashScope|null>(()=>session.value&&identity.value&&departments.value.some(d=>d.id===dept.value)&&!employeeScopeError.value?{tenantId:session.value.tenantId,actorId:identity.value.user.id,deptId:dept.value}:null)
const context=computed(()=>[session.value?.key,scope.value?.tenantId,scope.value?.actorId,dept.value].join(':'))
const storeName=computed(()=>departments.value.find(d=>d.id===dept.value)?.name||'当前门店')
const locked=computed(()=>busy.value||loading.value||!scope.value||!!pending.value||!!storageError.value||!day.value||day.value.id!==draftDay.value?.id)
let epoch=0,disposed=false,controller:AbortController|undefined
const current=(e:number,c:string)=>!disposed&&e===epoch&&c===context.value
const text=(e:unknown)=>e instanceof Error?e.message:String(e)
function refreshPending(){
 journals.value=[];storageError.value=''
 if(!scope.value)return
 try{
  const entries:[string,string|null][]=[]
  for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key)entries.push([key,localStorage.getItem(key)])}
  journals.value=cashJournals(entries,scope.value)
 }catch(e){storageError.value=text(e)}
}
function invalidate(){epoch++;controller?.abort();closeDialog();rows.value=[];total.value=0;page.value=1;day.value=null;draftDay.value=null;amount.value='';remark.value='';loading.value=false;busy.value=false;error.value='';notice.value='';refreshPending()}
watch(context,()=>{invalidate();if(scope.value)void load()},{flush:'sync'})
function changed(event:StorageEvent){if(event.key===null||event.key.startsWith('yc-cash-pending-v1:'))refreshPending()}
window.addEventListener('storage',changed)
onUnmounted(()=>{disposed=true;epoch++;controller?.abort();closeDialog();window.removeEventListener('storage',changed)})
async function readDay(e:number,c:string){
 const s=scope.value;if(!s)throw Error('没有当前员工门店授权')
 const raw=await request('/sport/wx/store/operating-day',{data:{deptId:s.deptId}})
 if(!current(e,c))throw Error('账号或门店已变化')
 if(raw?.status==='NOT_OPEN'){day.value=null;return null}
 const value=employeeDay(raw,s.deptId,s.actorId);day.value=value;return value
}
async function load(){
 if(!scope.value||loading.value||busy.value)return
 const e=epoch,c=context.value;loading.value=true;error.value='';controller?.abort();controller=new AbortController()
 try{
  let selectedDay:null|{id:string;date:string}=null
  try{selectedDay=await readDay(e,c)}catch(err){if(current(e,c)){day.value=null;error.value=text(err)}}
  if(!current(e,c))return
  if(!draftDay.value&&selectedDay)draftDay.value=selectedDay
  const raw=await request('/sport/wx/cash-ledger/page',{data:{deptId:dept.value,pageNo:page.value,pageSize:20},operatingDay:selectedDay?.id,signal:controller.signal})
  if(!current(e,c))return
  const result=cashPage(raw,dept.value);rows.value=result.list;total.value=result.total;refreshPending()
 }catch(err){if(current(e,c))error.value=text(err)}finally{if(current(e,c))loading.value=false}
}
async function result(journal:CashJournal,e:number,c:string){
 const raw=await request('/sport/wx/shift/to/amount/result',{method:'POST',data:cashPayload(journal)})
 if(!current(e,c))throw Error('账号或门店已变化，原请求仍保留')
 return cashOutcome(raw,journal)
}
function resolved(journal:CashJournal){
 const key=cashJournalKey(journal),saved=localStorage.getItem(key)
 if(saved&&saved!==JSON.stringify(journal))throw Error('浏览器原请求内容已变化，请联系管理员核对')
 // Each command has its own key: a late receipt cannot erase another tab's newer command.
 localStorage.removeItem(key);refreshPending();amount.value='';remark.value='';draftDay.value=day.value
 notice.value=`已确认${journal.businessDate}的备付金转入记账成功：${journal.transfer.shiftAmount}元。请核对共享流水与资金盘点。`
}
async function checkPending(){
 const journal=pending.value;if(!journal||busy.value||loading.value||storageError.value)return
 const e=epoch,c=context.value;busy.value=true;error.value='';notice.value=''
 let applied=false
 try{if(await result(journal,e,c)==='APPLIED'){resolved(journal);applied=true}else notice.value='暂未查到已入账记录。原请求继续保留；营业日一致时可重试原请求，换日或结店后请联系管理员核对。'}
 catch(err){if(current(e,c))error.value=text(err)}
 finally{if(current(e,c)){busy.value=false;if(applied)await load()}}
}
async function submit(retry=false){
 if(busy.value||loading.value||!scope.value||storageError.value||(!retry&&locked.value))return
 const e=epoch,c=context.value,s={...scope.value}
 let journal:CashJournal,stage:'preflight'|'write'|'confirm'='preflight',applied=false
 try{journal=retry?pending.value!:cashCommand(s,draftDay.value!,amount.value,remark.value,crypto.randomUUID());if(!journal)throw Error('没有可重试的原请求')}
 catch(err){error.value=text(err);return}
 busy.value=true;error.value='';notice.value=''
 try{
  if(retry&&await result(journal,e,c)==='APPLIED'){resolved(journal);applied=true;return}
  const selectedDay=await readDay(e,c);if(!selectedDay)throw Error('门店已结店或尚未开店；请查询原请求结果，暂不能记账')
  requireCashDay(journal,selectedDay)
  await showConfirmDialog({title:retry?'核对并重试原记账':'确认备付金转入记账',message:`门店：${storeName.value}\n营业日：${journal.businessDate}\n转入金额：${journal.transfer.shiftAmount}元\n备注：${journal.transfer.remark||'无'}\n${retry?'使用完全相同的原请求核对并重试。':'本次立即增加门店共享现金余额，请核对实际备付金。'}`})
  if(!current(e,c))return
  const latest=await readDay(e,c);if(!latest)throw Error('营业日已结束，请保留原请求核对');requireCashDay(journal,latest)
  if(!retry){refreshPending();if(journals.value.length||storageError.value)throw Error('已有待核对请求，请先确认其结果');localStorage.setItem(cashJournalKey(journal),JSON.stringify(journal));refreshPending()}
  if(!current(e,c))return
  stage='write'
  const response=await request('/sport/wx/shift/to/amount/safe-submit',{method:'POST',data:cashPayload(journal),operatingDay:journal.operatingDay})
  stage='confirm'
  if(!current(e,c))return
  if(response!==true)throw Error('记账回执不完整，请保留原请求核对')
  if(await result(journal,e,c)!=='APPLIED')throw Error('尚未确认原请求已入账，请查询结果，禁止生成新请求')
  resolved(journal);applied=true
 }catch(err){
  if(current(e,c)&&err!=='cancel'&&err!=='close'){
   error.value=text(err)
   if(stage==='write'&&err instanceof ApiError&&[400,403,10086].includes(err.code||0)){
    try{if(localStorage.getItem(cashJournalKey(journal))===JSON.stringify(journal))localStorage.removeItem(cashJournalKey(journal));refreshPending()}catch(storage){storageError.value=text(storage)}
   }
  }
 }finally{if(current(e,c)){busy.value=false;if(applied)await load()}}
}
async function resetDraft(){
 if(!day.value||busy.value||loading.value||pending.value)return
 const e=epoch,c=context.value
 try{await showConfirmDialog({title:'重新填写当前营业日',message:'保留需要的信息后确认；此操作仅清空尚未提交的输入，不会修改任何已入账流水。'});if(current(e,c)){amount.value='';remark.value='';draftDay.value=day.value}}
 catch{/* cancelled */}
}
async function initialize(){const login=session.value?.key;try{await loadAccount();if(disposed||login!==session.value?.key)return;if(employeeScopeError.value)throw Error(employeeScopeError.value);if(!departments.value.some(d=>d.id===dept.value))dept.value=departments.value[0]?.id||'';if(scope.value)await load()}catch(err){if(!disposed)error.value=text(err)}}
onMounted(initialize)
const sourceName=(source:number|null)=>source===0?'备付金转入':source===1?'门店转入（历史）':source===3?'其他来源（历史）':'历史来源待核对'
const sentAt=(value:string)=>new Date(value).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai',hour12:false})
</script>
<template>
 <div class="page-title"><p class="eyebrow">CASH LEDGER / 共享现金</p><h1>备付金转入与流水</h1><p class="intro">记录实际备付金，增加门店共享现金余额；这里不发起线上付款。</p></div>
 <section class="card filters"><label>员工门店<select v-model="dept"><option v-for="d in departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><van-button :loading="loading" :disabled="busy" @click="load">刷新营业日与共享流水</van-button></section>
 <van-empty v-if="!departments.length&&!loading" description="暂无员工门店授权，请联系管理员"/>
 <section v-if="error||storageError" class="card error" role="alert">{{error}} {{storageError}}</section><section v-if="notice" class="card success" role="status">{{notice}}</section>
 <van-notice-bar wrapable :text="day?`当前营业日 ${day.date}，门店现金由全体员工共用。`:'当前没有有效开店上下文，可查看历史或查询原请求结果，暂不能转入记账。'"/>
 <section v-if="pending" class="card confirm-panel"><h2>有{{journals.length}}笔记账待核对</h2><p>请先核对最早一笔，再办理后续记录。原请求会跨刷新、重新登录及换日保留。</p><dl><div><dt>原营业日</dt><dd>{{pending.businessDate}}</dd></div><div><dt>原金额</dt><dd>{{pending.transfer.shiftAmount}}元</dd></div><div><dt>提交时间（北京时间）</dt><dd>{{sentAt(pending.createdAt)}}</dd></div><div><dt>备注</dt><dd>{{pending.transfer.remark||'无'}}</dd></div></dl><p class="footnote">请求编号：{{pending.requestKey}}</p><van-button block type="primary" :disabled="busy||loading||!!storageError" @click="checkPending">查询原请求结果</van-button><van-button block plain :disabled="busy||loading||!day||day.id!==pending.operatingDay||!!storageError" @click="submit(true)">核对并重试原请求</van-button></section>
 <section v-if="scope&&!pending" class="card"><h2>登记备付金转入</h2><p class="intro">填写实际收到的金额，保存后直接入账。备注最多300字。</p><van-field v-model="amount" label="转入金额" inputmode="decimal" placeholder="大于0，最多两位小数" :disabled="locked"/><van-field v-model="remark" label="备注" type="textarea" maxlength="300" show-word-limit :disabled="locked"/><p v-if="day&&draftDay&&day.id!==draftDay.id" class="error">输入仍属于{{draftDay.date}}，营业日已变化；请核对后重新填写。</p><van-button block type="primary" :loading="busy" :disabled="locked" @click="submit(false)">核对并登记转入</van-button><van-button v-if="day&&day.id!==draftDay?.id" block plain :disabled="busy||loading" @click="resetDraft">重新填写当前营业日</van-button></section>
 <section class="card"><h2>门店共享流水</h2><p class="intro">包含当前门店其他员工的记录，营业日期与创建时间分别显示。历史未记录营业日的流水不推算归属日期。</p><van-loading v-if="loading"/><van-empty v-if="!loading&&!rows.length" description="当前页暂无流水"/><article v-for="row in rows" :key="row.id" class="cash-row"><h3>{{sourceName(row.source)}} · {{row.price}}元</h3><dl><div><dt>营业日</dt><dd>{{row.businessDate||'历史未记录'}}</dd></div><div><dt>经办人</dt><dd>{{row.userName}}</dd></div><div><dt>创建时间（北京时间）</dt><dd>{{createdLabel(row.createTime)}}</dd></div></dl><p v-if="row.remark">{{row.remark}}</p><p class="footnote">流水编号 {{row.id}}</p></article><div class="cash-pages"><van-button :disabled="busy||loading||page<=1" @click="page--;load()">上一页</van-button><span>第{{page}}页 / 共{{total}}笔</span><van-button :disabled="busy||loading||page*20>=total||page>=100000" @click="page++;load()">下一页</van-button></div></section>
</template>
<style scoped>.cash-row{padding:16px 0;border-bottom:1px solid var(--line,#dce4ef);overflow-wrap:anywhere}.cash-row h3{font-size:18px;line-height:1.6}.cash-pages{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-top:18px}.confirm-panel .van-button{margin-top:12px}</style>
