<script setup lang="ts">
import VoucherAttachments from '../components/VoucherAttachments.vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { departments, identity, loadAccount, employeeScopeError } from '../api/account'
import { request } from '../api/client'
import { session } from '../api/session'
import { employeeDay, entryDraftKey, entryFields, entryPayload, entrySnapshot, entryValues, type EntryKind } from '../domain/employee-entry'
const route = useRoute(), kind: EntryKind = route.params.kind === 'fund' ? 'fund' : 'business'
const title = kind === 'fund' ? '门店资金盘点' : '营业数据录入', path = kind === 'fund' ? 'fund' : 'service'
const fields = entryFields(kind), moneyFields = fields.filter(f=>!f.count), countFields = fields.filter(f=>f.count)
const dept = ref(String(route.query.deptId || '')), loading = ref(false), ready = ref(false), error = ref(''), success = ref(''), conflict = ref(false), uncertain = ref(false)
const values = ref<Record<string,string>>({}), shifts = ref<{value:string;label:string}[]>([]), day = ref<{id:string;date:string}|null>(null)
const revision = ref(''), original = ref<any>(null), draftKey = ref(''), hasDraft = ref(false)
const uploading = ref(false)
const locked = computed(()=>uploading.value || loading.value || conflict.value || uncertain.value)
let disposed = false, editing = false, controller: AbortController | undefined
onUnmounted(()=>{disposed=true;controller?.abort()})
watch([values,uploading],()=>{
 if (!editing || !ready.value || !draftKey.value || locked.value) return
 try { sessionStorage.setItem(draftKey.value,JSON.stringify({revision:revision.value,values:values.value,uncertain:false})); hasDraft.value = true }
 catch { error.value='草稿保存失败，请保持本页并核对后提交。' }
},{deep:true,flush:'sync'})
async function initialize() {
 loading.value=true;error.value=''
 try { await loadAccount(); if(disposed)return; if(employeeScopeError.value)throw Error(employeeScopeError.value); if(!departments.value.some(d=>d.id===dept.value))dept.value=departments.value[0]?.id||'' }
 catch(e){if(!disposed)error.value=(e as Error).message}
 finally{if(!disposed)loading.value=false}
 if(!disposed&&dept.value)await load()
}
async function load(replaceDraft=false) {
 if(loading.value || uploading.value)return
 loading.value=true;ready.value=false;error.value='';success.value='';editing=false;conflict.value=false;uncertain.value=false
 controller?.abort();controller=new AbortController()
 try {
  if(!departments.value.some(d=>d.id===dept.value))throw Error('请选择已授权的员工门店')
  const actor=String(identity.value!.user.id), login=session.value!.key
  const current=employeeDay(await request('/sport/wx/store/operating-day',{data:{deptId:dept.value},signal:controller.signal}),dept.value,actor)
  const raw=entrySnapshot(await request(`/sport/wx/night/count/${path}/safe-item`,{data:{deptId:dept.value},operatingDay:current.id,signal:controller.signal}))
  let options: {value:string;label:string}[]=[]
  if(kind==='business') {
   const rows=await request<any[]>('/system/dict-data/type',{data:{type:'class'},signal:controller.signal})
   if(!Array.isArray(rows))throw Error('班次选项不完整')
   options=rows.filter(r=>r.status == null || String(r.status)==='0').map(r=>({value:String(r.dictValue),label:String(r.dictLabel)}))
   if(!options.length)throw Error('暂无启用班次，请联系管理员配置')
  }
  if(disposed)return
  const key=entryDraftKey(login,actor,dept.value,current.id,kind)
  if(replaceDraft)sessionStorage.removeItem(key)
  day.value=current;revision.value=raw.revision;original.value=raw.record;shifts.value=options;draftKey.value=key
  values.value=entryValues(kind,raw.record)
  if(kind==='business'&&!values.value.classes)values.value.classes=options.find(s=>s.value==='Late')?.value || ''
  hasDraft.value=false
  const saved=sessionStorage.getItem(key)
  if(saved){
   const draft=JSON.parse(saved)
   if(!draft || typeof draft.values!=='object' || !draft.values || Array.isArray(draft.values) || !draft.revision)throw Error('草稿不完整，请确认替换为服务器数据')
   values.value={...values.value,...draft.values};hasDraft.value=true
   conflict.value=draft.revision!==raw.revision;uncertain.value=draft.uncertain===true
  }
  ready.value=true;editing=true
 } catch(e){if(!disposed)error.value=(e as Error).message}
 finally{if(!disposed)loading.value=false}
}
async function replace() {
 try{await showConfirmDialog({title:'重新读取并核对',message:'将以服务器最新记录替换本页草稿。若上一笔提交结果未明，请先保留需要核对的数值，再确认。',confirmButtonText:'读取服务器记录'});await load(true)}catch(e){if(e!=='cancel'&&e!=='close')error.value=(e as Error).message}
}
async function submit() {
 if(!ready.value||locked.value||!day.value)return
 error.value='';success.value=''
 let record:Record<string,unknown>
 try{record=entryPayload(kind,values.value,shifts.value,original.value)}catch(e){error.value=(e as Error).message;return}
 loading.value=true
 try {
  await showConfirmDialog({title:'确认提交'+title,message:`${day.value.date} · ${departments.value.find(d=>d.id===dept.value)?.name}。${kind==='fund'?'资金由门店共用，请与当班人员核对，提交会更新该营业日资金盘点。':'请核对当前班次和销量；提交将更新本账号可操作的营业数据。'}`,confirmButtonText:'确认提交'})
  if(disposed)return
  sessionStorage.setItem(draftKey.value,JSON.stringify({revision:revision.value,values:values.value,uncertain:true}));uncertain.value=true
  await request(`/sport/wx/night/count/${path}/safe-submit`,{method:'POST',data:{deptId:dept.value,revision:revision.value,record},operatingDay:day.value.id})
  if(disposed)return
  sessionStorage.removeItem(draftKey.value);hasDraft.value=false;uncertain.value=false;ready.value=false
  loading.value=false;await load();success.value=ready.value?'提交成功，已重新读取服务器记录。':'提交已成功，最新记录未能读取，请重新读取核对。'
 } catch(e){if(!disposed&&e!=='cancel'&&e!=='close')error.value=(e as Error).message||'提交结果尚未确认，请重新读取并核对，勿重复提交'}
 finally{if(!disposed)loading.value=false}
}
onMounted(initialize)
</script>
<template><div class="page-title"><p class="eyebrow">STORE ENTRY / 营业日录入</p><h1>{{title}}</h1><p class="intro">{{kind==='fund'?'五类资金全店共用，不分摊个人盈亏。':'按当前营业日记账，跨午夜仍归开店当天。'}}</p></div><section v-if="departments.length" class="card filters"><label>员工门店<select v-model="dept" :disabled="loading || uploading" @change="load()"><option v-for="d in departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><van-button :disabled="loading || uploading" @click="hasDraft || uncertain ? replace() : load()">重新读取记录</van-button></section><section v-if="error" class="card error" role="alert">{{error}}<van-button v-if="!ready" :disabled="loading" @click="departments.length ? replace() : initialize()">重新读取</van-button></section><section v-if="success" class="card success" role="status">{{success}}</section><section v-if="loading && !ready" class="card state"><van-loading />正在读取门店记录</section><van-empty v-if="!loading && !error && !departments.length" description="暂无员工门店授权" /><template v-if="ready"><van-notice-bar v-if="!loading && (conflict || uncertain)" wrapable :text="conflict?'服务器记录已变化。已保留草稿，提交已锁定，请核对后重新读取。':'上一笔提交尚未核对结果，已暂停提交。请重新读取服务器记录核对，勿重复提交。'" /><section class="card"><div class="day-status"><h2>{{day?.date}}</h2><span class="status-pill open">营业中</span></div><p class="intro">{{original?'已存在记录，本次提交将更新。':'尚无记录，请核对后首次提交。'}}{{hasDraft?' 本标签页草稿已保存。':''}}</p></section><form @submit.prevent="submit"><section class="card filters entry-fields"><label v-if="kind==='business'">班次<select v-model="values.classes" :disabled="locked"><option value="" disabled>请选择班次</option><option v-for="s in shifts" :key="s.value" :value="s.value">{{s.label}}</option></select></label><h2 class="full-row">{{kind==='fund'?'五类资金余额 · 元':'营业金额 · 元'}}</h2><label v-for="f in moneyFields" :key="f.key">{{f.label}}<input v-model="values[f.key]" type="text" inputmode="decimal" autocomplete="off" :disabled="locked" maxlength="14" placeholder="请填写金额"></label><h2 class="full-row">笔数{{kind==='fund'?'（选填，不填保持原值）':''}}</h2><label v-for="f in countFields" :key="f.key">{{f.label}}<input v-model="values[f.key]" type="text" inputmode="numeric" autocomplete="off" :disabled="locked" maxlength="8" :placeholder="f.optional?'可留空':'请填写笔数'"></label><p v-if="kind==='business'" class="intro full-row">移动支付、缴款等仅为账务录入，不会发起支付或转账。凭证仅保存于本平台，最多6张；修改凭证后须提交营业数据才会关联记录。</p></section><VoucherAttachments v-if="kind === 'business'" :model-value="values.voucherPic ?? original?.voucherPic ?? ''" :dept-id="dept" :operating-day="day!.id" :disabled="locked" @update:model-value="value => values.voucherPic = value" @busy="value => uploading = value" /><van-button type="primary" native-type="submit" block :loading="loading" :disabled="conflict || uncertain || uploading">核对并提交</van-button><van-button v-if="conflict || uncertain" block class="close-submit" :disabled="loading" @click="replace">读取服务器记录并核对</van-button></form></template></template>
