<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {showConfirmDialog} from 'vant'
import {departments,identity,loadAccount,employeeScopeError} from '../api/account'
import {request} from '../api/client'
import {session} from '../api/session'
import {employeeDay} from '../domain/employee-entry'
import {countLines,countTotal,countPayload,morningAmounts,morningMoneyFields,morningSummary,type CountLine,type CountKind} from '../domain/inventory-entry'
const route=useRoute(),kind:CountKind=route.params.kind==='morning'?'morning':'evening',title=kind==='morning'?'早盘与期初核对':'晚盘库存核对'
const dept=ref(String(route.query.deptId||'')),loading=ref(false),ready=ref(false),error=ref(''),success=ref(''),conflict=ref(false),uncertain=ref(false),hasDraft=ref(false)
const day=ref<{id:string;date:string}|null>(null),revision=ref(''),lines=ref<CountLine[]>([]),funds=ref<Record<string,string>>({}),staff=ref<{value:string;label:string}[]>([]),owner=ref(''),remark=ref(''),fundLocked=ref(false),countLocked=ref(false),hidden=ref(false)
let stocks:any[]=[],baseCash:unknown,draftKey='',editing=false,disposed=false,controller:AbortController|undefined
const locked=computed(()=>loading.value||conflict.value||uncertain.value||countLocked.value)
const earlyDiff=computed(()=>{if(kind!=='morning'||countLocked.value||hidden.value)return null;try{return morningSummary(lines.value,stocks,funds.value,baseCash)}catch{return null}})
const totals=computed(()=>{try{return countTotal(lines.value,kind)}catch{return null}})
onUnmounted(()=>{disposed=true;controller?.abort()})
function draft(){return {revision:revision.value,lines:lines.value,funds:funds.value,owner:owner.value,remark:remark.value,uncertain:uncertain.value}}
watch([lines,funds,owner,remark],()=>{if(editing&&ready.value&&!locked.value)try{sessionStorage.setItem(draftKey,JSON.stringify(draft()));hasDraft.value=true}catch{error.value='草稿保存失败，请保持本页核对提交。'}},{deep:true,flush:'sync'})
async function initialize(){loading.value=true;error.value='';try{await loadAccount();if(disposed)return;if(employeeScopeError.value)throw Error(employeeScopeError.value);if(!departments.value.some(d=>d.id===dept.value))dept.value=departments.value[0]?.id||''}catch(e){if(!disposed)error.value=(e as Error).message}finally{if(!disposed)loading.value=false}if(!disposed&&dept.value)await load()}
async function load(replace=false){
 if(loading.value)return;loading.value=true;ready.value=false;editing=false;error.value='';success.value='';conflict.value=false;uncertain.value=false
 controller?.abort();controller=new AbortController()
 try{
  if(!departments.value.some(d=>d.id===dept.value))throw Error('请选择有员工权限的门店')
  const actor=String(identity.value!.user.id),current=employeeDay(await request('/sport/wx/store/operating-day',{data:{deptId:dept.value},signal:controller.signal}),dept.value,actor)
  const options={data:{deptId:dept.value},operatingDay:current.id,signal:controller.signal}
  const early=await request('/sport/wx/early/count/data',options)
  const raw=kind==='morning'?early:await request('/sport/wx/night/count/bill/data',options)
  if(!/^[a-f0-9]{64}$/.test(raw?.revision))throw Error('盘点版本不完整')
  const parsed=countLines(raw.materialVOList,early.zchInventoryGglList,dept.value)
  const people=kind==='morning'?await request<any[]>('/sport/wx/store/active-staff',options):[]
  if(kind==='morning'&&(!Array.isArray(people)||!people.some(p=>String(p.value)===actor)))throw Error('核对人员不在本店有效员工范围')
  if(disposed)return
  day.value=current;revision.value=raw.revision;lines.value=parsed;stocks=early.zchInventoryGglList;baseCash=early.zchInventoryFund?.xj
  staff.value=people.map(p=>({value:String(p.value),label:String(p.label)}));owner.value=actor;remark.value=early.zchCheckGgl?.remark||''
  if(kind==='morning'){funds.value=morningAmounts(early.morningFunds);fundLocked.value=early.morningFunds.locked;hidden.value=early.morningFunds.hidden;countLocked.value=!!early.zchCheckGgl?.id&&early.morningFunds.started}
  else{funds.value={};fundLocked.value=false;countLocked.value=false;hidden.value=false}
  draftKey=`yc-count:${session.value!.key}:${actor}:${dept.value}:${current.id}:${kind}`
  if(replace)sessionStorage.removeItem(draftKey)
  const saved=sessionStorage.getItem(draftKey);hasDraft.value=false
  if(saved){const d=JSON.parse(saved);if(!Array.isArray(d.lines)||!d.funds||!d.revision)throw Error('草稿不完整，请重新读取替换');conflict.value=d.revision!==raw.revision;uncertain.value=d.uncertain===true;lines.value=d.lines;if(!fundLocked.value)funds.value=d.funds;owner.value=d.owner;remark.value=d.remark;hasDraft.value=true}
  ready.value=true;editing=true
 }catch(e){if(!disposed)error.value=(e as Error).message}finally{if(!disposed)loading.value=false}
}
async function reload(){try{await showConfirmDialog({title:'重新读取服务器记录',message:'将替换本标签页盘点草稿。提交结果不明时请先保留待核对数值。',confirmButtonText:'读取并核对'});await load(true)}catch(e){if(e!=='cancel'&&e!=='close')error.value=(e as Error).message}}
async function submit(){
 if(!ready.value||locked.value||!day.value)return
 error.value='';success.value='';let body:Record<string,unknown>
 try{
  body={deptId:dept.value,revision:revision.value,materialVOList:countPayload(lines.value,kind,dept.value)}
  if(kind==='morning'){
   if(!staff.value.some(p=>p.value===owner.value))throw Error('请选择本店有效核对人员');if(remark.value.length>255)throw Error('备注不能超过255字')
   Object.assign(body,morningSummary(lines.value,stocks,funds.value,baseCash),funds.value,{checkUserId:owner.value,remark:remark.value})
  }else body.classes='Late'
 }catch(e){error.value=(e as Error).message;return}
 loading.value=true
 try{
  await showConfirmDialog({title:'确认提交'+title,message:`${day.value.date} · ${departments.value.find(d=>d.id===dept.value)?.name}。门店库存共用，请与当班人员核对完整明细；数量为零的票种也会保留在本次盘点。`,confirmButtonText:'确认提交'})
  if(disposed)return
  uncertain.value=true;sessionStorage.setItem(draftKey,JSON.stringify(draft()))
  await request(kind==='morning'?'/sport/wx/early/count/safe-submit':'/sport/wx/night/count/bill/safe-submit',{method:'POST',data:body,operatingDay:day.value.id})
  if(disposed)return
  sessionStorage.removeItem(draftKey);hasDraft.value=false;uncertain.value=false;loading.value=false;await load();success.value=ready.value?'提交成功，已重新读取服务器盘点记录。':'提交已成功，请重新读取核对最新记录。'
 }catch(e){if(!disposed&&e!=='cancel'&&e!=='close')error.value=(e as Error).message||'提交结果未确认，请核对服务器记录'}finally{if(!disposed)loading.value=false}
}
onMounted(initialize)
</script>
<template><div class="page-title"><p class="eyebrow">INVENTORY / 盘点</p><h1>{{title}}</h1><p class="intro">按营业日核对门店共用库存，实盘为零的票种也需要保留。</p></div><section v-if="departments.length" class="card filters"><label>员工门店<select v-model="dept" :disabled="loading" @change="load()"><option v-for="d in departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><van-button :disabled="loading" @click="hasDraft||uncertain?reload():load()">重新读取盘点</van-button></section><section v-if="error" class="card error" role="alert">{{error}}<van-button v-if="!ready" :disabled="loading" @click="departments.length?reload():initialize()">重新读取</van-button></section><section v-if="success" class="card success" role="status">{{success}}</section><section v-if="loading&&!ready" class="card state"><van-loading />正在读取营业日盘点</section><van-empty v-if="!loading&&!error&&!departments.length" description="暂无员工门店授权" /><template v-if="ready"><section class="card"><div class="day-status"><h2>{{day?.date}}</h2><span class="status-pill open">营业中</span></div><p class="intro">{{hasDraft?'本标签页草稿已保存。':'请核对服务器最新明细。'}}{{kind==='evening'?'晚盘前须处理待确认的订票和调拨。':''}}</p></section><van-notice-bar v-if="!loading && (conflict||uncertain||countLocked)" wrapable :text="countLocked?'已开始营业，已有早盘不能直接替换；请联系老板按留痕更正流程处理。':conflict?'服务器版本已变化，已保留草稿。请核对后重新读取，不能直接提交旧草稿。':'上一笔提交结果尚未确认，已暂停提交。请重新读取服务器记录核对。'" /><form @submit.prevent="submit"><section v-if="kind==='morning'" class="card filters entry-fields"><h2 class="full-row">五类期初资金 · 元</h2><p v-if="fundLocked" class="intro full-row">{{hidden?'当前账号隐藏早班资金，界面显示零；真实资金由服务器保留。':'早班资金已锁定，本次盘点沿用门店共用资金。'}}</p><label v-for="f in morningMoneyFields" :key="f.key">{{f.label}}<input v-model="funds[f.key]" type="text" inputmode="decimal" :disabled="locked||fundLocked" maxlength="13"></label><label>核对人员<select v-model="owner" :disabled="locked"><option v-for="p in staff" :key="p.value" :value="p.value">{{p.label}}</option></select></label><p class="intro full-row">可以为本店尚无早盘的员工首次代盘；已有记录不能通过代盘覆盖。</p><label class="full-row">盘点备注<input v-model="remark" :disabled="locked" maxlength="255" placeholder="选填，最多255字"></label></section><section v-for="line in lines" :key="line.materialId" class="card"><h2>{{line.materialName}}</h2><p class="intro">每包 {{line.price}} 元 · 每张 {{line.money}} 元</p><div class="date-range filters"><label>实盘包数<input v-model="line.invPackageNum" type="text" inputmode="numeric" :disabled="locked" maxlength="7"></label><label>实盘张数<input v-model="line.invZhangNum" type="text" inputmode="numeric" :disabled="locked" maxlength="7"></label></div></section><section class="card"><h2>实盘合计</h2><dl v-if="totals"><div><dt>库存金额</dt><dd>{{totals.amount}} 元</dd></div><div><dt>包数 / 张数</dt><dd>{{totals.packages}} / {{totals.sheets}}</dd></div></dl><p v-else class="error">请填写有效的非负整数数量。</p><dl v-if="earlyDiff"><div><dt>库存差额</dt><dd>{{earlyDiff.invYesterdayDiff}} 元</dd></div><div><dt>现金差额</dt><dd>{{earlyDiff.invCashDiff}} 元</dd></div></dl><p v-if="earlyDiff" class="intro">差额相对于本次读取的门店库存和现金快照核算，提交时由服务器再次核对。</p><p v-if="!lines.length" class="intro">当前无票种库存；提交会记录空库存盘点。</p></section><van-button type="primary" native-type="submit" block :loading="loading" :disabled="conflict||uncertain||countLocked">核对并提交</van-button><van-button v-if="conflict||uncertain" class="close-submit" block :disabled="loading" @click="reload">读取服务器记录并核对</van-button></form></template></template>
