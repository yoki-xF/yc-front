<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {closeDialog,showConfirmDialog} from 'vant'
import {departments,employeeScopeError,identity,loadAccount} from '../api/account'
import {session} from '../api/session'
import {ApiError,request} from '../api/client'
import {employeeDay} from '../domain/employee-entry'
import {activityId,activityStaff,activitySnapshot,activityPayload,activityJournal,activityJournalKey,readActivityJournal,requireActivityDay,compareActivity,type ActivityScope,type ActivityLine,type ActivitySnapshot,type ActivityJournal} from '../domain/activity-entry'
const route=useRoute(),dept=ref(String(route.query.deptId||'')),busy=ref(false),error=ref(''),notice=ref(''),storageError=ref('')
const day=ref<{id:string;date:string}|null>(null),snapshot=ref<ActivitySnapshot|null>(null),lines=ref<ActivityLine[]>([]),staff=ref<{value:string;label:string}[]>([]),pending=ref<ActivityJournal|null>(null),comparison=ref<ActivitySnapshot|null>(null)
const scope=computed<ActivityScope|null>(()=>session.value&&identity.value&&!employeeScopeError.value&&departments.value.some(d=>d.id===dept.value)?{tenantId:session.value.tenantId,actorId:identity.value.user.id,deptId:dept.value}:null)
const context=computed(()=>[session.value?.key,scope.value?.tenantId,scope.value?.actorId,dept.value].join(':'))
const locked=computed(()=>busy.value||!scope.value||!snapshot.value||!day.value||!!pending.value||!!storageError.value)
let epoch=0,disposed=false,controller:AbortController|undefined
const current=(e:number,c:string)=>!disposed&&epoch===e&&context.value===c
const message=(e:unknown)=>e instanceof Error?e.message:String(e)
function restore(){comparison.value=null;pending.value=null;storageError.value='';if(!scope.value)return;try{pending.value=readActivityJournal(localStorage.getItem(activityJournalKey(scope.value)),scope.value)}catch(e){storageError.value='原请求日志无法读取，禁止提交：'+message(e)}}
function invalidate(){epoch++;controller?.abort();closeDialog();busy.value=false;day.value=null;snapshot.value=null;lines.value=[];staff.value=[];error.value='';notice.value='';restore()}
watch(context,()=>{invalidate();if(scope.value)void load()},{flush:'sync'})
function storage(event:StorageEvent){if(event.key===null||event.key.startsWith('yc-activity-pending-v1:'))restore()}
window.addEventListener('storage',storage)
onUnmounted(()=>{disposed=true;epoch++;controller?.abort();closeDialog();window.removeEventListener('storage',storage)})
async function readDay(s:ActivityScope,e:number,c:string){
 activityId(s.tenantId);activityId(s.actorId);activityId(s.deptId)
 const raw=await request('/sport/wx/store/operating-day',{data:{deptId:s.deptId},signal:controller?.signal})
 if(!current(e,c))throw Error('账号或门店已变化')
 return employeeDay(raw,s.deptId,s.actorId)
}
async function load(){
 if(busy.value||!scope.value)return
 const e=epoch,c=context.value,s={...scope.value};busy.value=true;error.value='';notice.value='';controller=new AbortController();restore()
 try{
  const original=pending.value
  if(original?.requestKey){
   const response=await request<{status:string;deptId:string;requestKey:string}>('/sport/wx/activity/result',{method:'POST',data:{...original.payload,requestKey:original.requestKey},signal:controller.signal})
   if(!current(e,c))return
   if(response?.deptId!==s.deptId||response.requestKey!==original.requestKey)throw Error('原请求回执范围不符')
   if(response.status==='APPLIED'){
    const key=activityJournalKey(s)
    if(localStorage.getItem(key)!==JSON.stringify(original))throw Error('原请求日志已变化，请重新核对')
    localStorage.removeItem(key);restore()
    snapshot.value=null;lines.value=[];day.value=null
    notice.value='原促销请求已保存，请重新读取最新记录。'
    return
   }
   if(response.status!=='NOT_FOUND')throw Error('原请求回执状态无效')
   notice.value='暂未查到原请求的成功回执，请保留原请求并联系管理员核对。'
   return
  }
  const target=original?.day||await readDay(s,e,c)
  const raw=await request('/sport/wx/activity/safe-item',{data:{deptId:s.deptId},operatingDay:target.id,signal:controller.signal})
  if(!current(e,c))return
  const parsed=activitySnapshot(raw,s.deptId)
  if(pending.value){notice.value=compareActivity(pending.value,parsed,target);comparison.value=parsed;return}
  if(!parsed.items.length){day.value=target;snapshot.value=parsed;lines.value=[];staff.value=[];return}
  const people=activityStaff(await request('/sport/wx/store/active-staff',{data:{deptId:s.deptId},operatingDay:target.id,signal:controller.signal}))
  if(!current(e,c))return
  // A successful empty snapshot must also remove every prior editable row.
  day.value=target;snapshot.value=parsed;lines.value=parsed.items.map(i=>({...i}));staff.value=people
 }catch(err){if(current(e,c))error.value=message(err)}finally{if(current(e,c))busy.value=false}
}
async function reread(){
 if(busy.value)return
 if(pending.value||!lines.value.length){await load();return}
 const e=epoch,c=context.value
 try{await showConfirmDialog({title:'重新读取完整活动',message:'将替换当前尚未提交的输入，请先保留需要的信息。'});if(current(e,c))await load()}catch{/* cancelled */}
}
async function submit(){
 if(locked.value||!scope.value||!day.value||!snapshot.value)return
 const e=epoch,c=context.value,s={...scope.value},originalDay={...day.value}
 let journal:ActivityJournal,writeKey='',encoded='',stage:'preflight'|'write'|'receipt'='preflight'
 try{journal=activityJournal(s,originalDay,activityPayload(snapshot.value,lines.value,s.deptId,staff.value),crypto.randomUUID())}catch(err){error.value=message(err);return}
 busy.value=true;error.value='';notice.value=''
 try{
  requireActivityDay(originalDay,await readDay(s,e,c))
  await showConfirmDialog({title:'确认完整促销记录',message:`${departments.value.find(d=>d.id===s.deptId)?.name} · ${originalDay.date}\n将保存全部${journal.payload.items.length}项活动金额及人员，包含零金额。`})
  if(!current(e,c))return
  requireActivityDay(originalDay,await readDay(s,e,c))
  restore();if(pending.value||storageError.value)throw Error('已有待核对原请求或日志不可用，禁止提交')
  const key=activityJournalKey(s);writeKey=key;encoded=JSON.stringify(journal)
  localStorage.setItem(key,encoded)
  if(localStorage.getItem(key)!==encoded)throw Error('原请求日志保存失败，未提交')
  restore();if(!current(e,c))return
  stage='write'
  const response=await request('/sport/wx/activity/safe-submit',{method:'POST',data:{...journal.payload,requestKey:journal.requestKey},operatingDay:journal.day.id})
  if(!current(e,c))return
  stage='receipt'
  if(response!==true)throw Error('提交回执不完整，请保留原请求核对')
  if(localStorage.getItem(key)!==encoded)throw Error('原请求日志已变化，请联系管理员核对')
  localStorage.removeItem(key);restore();snapshot.value=null;lines.value=[];day.value=null;notice.value='保存成功，请重新读取最新记录。'
 }catch(err){if(current(e,c)&&err!=='cancel'&&err!=='close'){
  error.value=message(err)
  if(stage==='write'&&err instanceof ApiError&&[400,403,10086].includes(err.code||0)){
   try{if(localStorage.getItem(writeKey)===encoded)localStorage.removeItem(writeKey);restore();snapshot.value=null;lines.value=[];day.value=null;notice.value='请求已明确拒绝，请重新读取最新营业日与活动后核对。'}catch(storage){storageError.value=message(storage)}
  }
 }}finally{if(current(e,c))busy.value=false}
}
async function initialize(){const login=session.value?.key;try{await loadAccount();if(disposed||login!==session.value?.key)return;if(employeeScopeError.value)throw Error(employeeScopeError.value);if(!departments.value.some(d=>d.id===dept.value))dept.value=departments.value[0]?.id||'';if(scope.value)await load()}catch(err){if(!disposed)error.value=message(err)}}
onMounted(initialize)
</script>
<template>
 <div class="page-title"><p class="eyebrow">ACTIVITY / 促销活动</p><h1>促销活动记录</h1><p class="intro">按门店营业日核对完整促销金额与经办人员；金额为零的活动也要保留。</p></div>
 <section class="card filters"><label>员工门店<select v-model="dept" :disabled="busy"><option v-for="d in departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><van-button :loading="busy" @click="reread">{{pending?.requestKey?'查询原请求结果':pending?'读取原营业日并比较':'重新读取完整活动'}}</van-button></section>
 <section v-if="error||storageError" class="card error" role="alert">{{error}} {{storageError}}</section><section v-if="notice" class="card success" role="status">{{notice}}</section>
 <van-empty v-if="!departments.length&&!busy" description="暂无员工门店授权"/>
 <section v-if="pending" class="card"><h2>原提交结果待核对</h2><p>原营业日 {{pending.day.date}}。原范围、版本及完整金额已跨刷新和重新登录保留。所有新提交已暂停；读取比较不会重试或清除日志。</p><p class="footnote">原版本 {{pending.payload.revision}}</p><dl v-for="item in pending.payload.items" :key="item.activityId"><div><dt>活动 {{item.activityId}} / 员工 {{item.userId}}</dt><dd>{{item.salesAmount}} 元</dd></div></dl><template v-if="comparison"><h3>本次重新读取的服务器记录</h3><p class="footnote">版本 {{comparison.revision}}</p><van-empty v-if="!comparison.items.length" description="服务器当前无活动"/><dl v-for="item in comparison.items" :key="item.activityId"><div><dt>{{item.activityName}} / 员工 {{item.userId||'未记录'}}</dt><dd>{{item.salesAmount||'未记录'}} 元</dd></div></dl></template><p>结店后不能无原因更正，请联系管理员通过审计更正流程核对。</p></section>
 <template v-if="snapshot&&!pending"><section class="card"><h2>原营业日 {{day?.date}}</h2><p class="intro">此表单营业日锁定；换日或结店后禁止直接保存。重新读取会替换输入。</p></section><van-empty v-if="!lines.length" description="当前营业日暂无促销活动"/><form v-else @submit.prevent="submit"><section v-for="line in lines" :key="line.activityId" class="card filters entry-fields"><h2 class="full-row">{{line.activityName}}</h2><label>促销金额（元）<input v-model="line.salesAmount" inputmode="decimal" type="text" maxlength="13" :disabled="locked" placeholder="非负金额，最多两位小数"></label><label>经办员工<select v-model="line.userId" :disabled="locked"><option value="" disabled>请选择有效员工</option><option v-for="person in staff" :key="person.value" :value="person.value">{{person.label}}</option></select></label><p v-if="line.userId&&!staff.some(p=>p.value===line.userId)" class="error full-row">原经办人已不在有效员工选项内，请核对后选择。</p></section><van-button native-type="submit" type="primary" block :loading="busy" :disabled="locked">核对并保存全部活动</van-button></form></template>
</template>
