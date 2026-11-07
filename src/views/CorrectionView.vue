<script setup lang="ts">
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {showConfirmDialog} from 'vant'
import {ApiError,request} from '../api/client'
import {session} from '../api/session'
import {getResource,can} from '../domain/resources.js'
import {definitions,command,labelled,reports} from '../domain/corrections.js'
import {correctionPending} from '../domain/correction-pending'
import {identityId} from '../domain/account-login'
const route=useRoute(),type=String(route.params.type),id=String(route.params.id)
const loading=ref(false),ready=ref(false),error=ref(''),record=ref<any>(null),values=ref<Record<string,string>>({}),lines=ref<any[]>([]),reason=ref(''),preview=ref<any>(null),previewCommand=ref<any>(null),pending=ref<any>(null),result=ref<any>(null),history=ref<any[]>([]),blocked=ref(false)
const fields=computed(()=>record.value?definitions(type,record.value):[]),locked=computed(()=>loading.value||!!pending.value||!!result.value||blocked.value||record.value?.correctionSupported!==true)
let disposed=false,controller:AbortController|undefined,actorId=''
const login=session.value?.key,tenant=session.value?.tenantId
const current=()=>!disposed&&!!login&&session.value?.key===login
watch(()=>session.value?.key,()=>{if(!current()){controller?.abort();ready.value=false;blocked.value=true;record.value=null;values.value={};lines.value=[];reason.value='';history.value=[];preview.value=null;previewCommand.value=null;pending.value=null;result.value=null;loading.value=false;error.value='登录已变化，请重新进入更正页面'}})
function key(){if(!current()||!actorId||!tenant)throw Error('请重新登录');return `yc-correction:${tenant}:${actorId}:${type}:${id}`}
onUnmounted(()=>{disposed=true;controller?.abort()})
watch([values,lines,reason],()=>{preview.value=null;previewCommand.value=null},{deep:true,flush:'sync'})
async function load(){
 if(loading.value||!current())return;loading.value=true;ready.value=false;error.value='';preview.value=null;previewCommand.value=null;result.value=null;blocked.value=false;record.value=null;history.value=[]
 controller?.abort();controller=new AbortController()
 try{
  if(!['inventory','funds','business','commission'].includes(type)||!/^\d+$/.test(id)||id==='0')throw Error('更正记录类型或编号无效')
  const info=await request('/system/auth/get-permission-info',{signal:controller.signal}),resource=getResource(type)
  if(!current())return
  actorId=identityId(info.user?.id)
  if(!can(info.permissions,resource.permission)||!can(info.permissions,resource.permission.replace(/:query$/,':update')))throw Error('当前账号没有盘点查询和更正权限')
  const raw=await request(`/sport/boss/records/${type}/get`,{data:{id},signal:controller.signal})
  if(!raw||String(raw.id)!==id)throw Error('记录编号不一致')
  if(!current())return
  record.value=raw;values.value=Object.fromEntries(definitions(type,raw).map((f:any)=>[f.key,String(raw[f.key]??'')]));lines.value=(raw.lines||[]).map((l:any)=>({...l}));reason.value=''
  if(raw.correctionHistoryAvailable!==false)history.value=await request('/sport/boss/corrections/history',{data:{type,id},signal:controller.signal})
  if(!current())return
  const stable=key(),legacy=`yc-correction:${login}:${type}:${id}`,saved=sessionStorage.getItem(stable),old=sessionStorage.getItem(legacy)
  if(saved&&old&&saved!==old)throw Error('存在多笔待核对更正，请联系管理员核对')
  pending.value=raw.correctionHistoryAvailable===false?null:correctionPending(saved||old,type,id)
  if(pending.value&&old){sessionStorage.setItem(stable,JSON.stringify(pending.value));sessionStorage.removeItem(legacy)}
  if(pending.value){values.value={...values.value,...pending.value.fields};reason.value=pending.value.reason;const edits=new Map(pending.value.lines.map((l:any)=>[String(l.id),l]));lines.value=lines.value.map(l=>({...l,...(edits.get(String(l.id)) as any||{})}))}
  ready.value=true
 }catch(e){if(current()){error.value=(e as Error).message;blocked.value=true}}
 finally{if(current())loading.value=false}
}
async function getPreview(){
 if(locked.value||!ready.value||!current())return
 loading.value=true;error.value='';preview.value=null;previewCommand.value=null
 try{
  const c=command(type,record.value,values.value,lines.value,reason.value,crypto.randomUUID())
  const raw=await request('/sport/boss/corrections/preview',{method:'POST',data:c})
  if(!current())return
  if(raw?.revision!==c.revision||!Array.isArray(raw.changes)||!Array.isArray(raw.impacts))throw Error('更正预览范围或版本不一致')
  preview.value=raw;previewCommand.value=c
 }catch(e){if(current())error.value=(e as Error).message}
 finally{if(current())loading.value=false}
}
async function apply(){
 if(!current()||loading.value||blocked.value||result.value||(!pending.value&&!previewCommand.value))return
 loading.value=true;error.value=''
 try{
  await showConfirmDialog({title:pending.value?'核对并重试原更正':'确认财务更正',message:pending.value?'将使用相同请求标识核对并重试，不会生成另一笔更正。请确认当前记录及原因。':'确认已核对变更、库存/资金影响和报表？服务器会再次核对版本，原子更新并保存审计记录。',confirmButtonText:pending.value?'重试原请求':'确认更正'})
  if(!current())return
  if(!pending.value){sessionStorage.setItem(key(),JSON.stringify(previewCommand.value));pending.value=previewCommand.value}
  const raw=await request('/sport/boss/corrections/apply',{method:'POST',data:pending.value})
  if(!current())return
  if(raw?.status!=='APPLIED'||raw.recordId!==id||raw.type!==type||typeof raw.auditId!=='string')throw Error('更正回执不完整，请保留原请求核对')
  sessionStorage.removeItem(key());result.value=raw;pending.value=null;preview.value=null;previewCommand.value=null
  history.value=await request('/sport/boss/corrections/history',{data:{type,id}})
 }catch(e){if(current()&&e!=='cancel'&&e!=='close'){error.value=(e as Error).message||'更正结果未确认，请保留原请求核对';if(e instanceof ApiError&&[400,403,10086].includes(e.code||0)){sessionStorage.removeItem(key());pending.value=null;preview.value=null;previewCommand.value=null;blocked.value=true}}}
 finally{if(current())loading.value=false}
}
onMounted(load)
</script>
<template><router-link class="text-link" :to="'/records/'+type+'/'+id">← 返回记录详情</router-link><div class="page-title"><p class="eyebrow">CORRECTION / 留痕更正</p><h1>更正有据，账目可查</h1><p class="intro">先填写原因并预览影响，再核对提交。结店后更正会重新核对受影响报表。</p></div><section v-if="error" class="card error" role="alert">{{error}}</section><section v-if="loading" class="card state"><van-loading />正在读取或核对更正</section><section v-if="record?.correctionSupported===false" class="card"><h2>当前记录暂不可更正</h2><p class="intro">{{record.correctionBlockedReason||'请联系管理员核对关联账务。'}}</p></section><van-notice-bar v-if="pending&&!loading" wrapable text="上一笔更正结果尚未确认，原请求已保存在本标签页。请核对原因和数值，只能重试原请求。" /><template v-if="ready"><section class="card"><h2>{{record.deptName||getResource(type).title}}</h2><p class="intro">记录 {{id}} · {{String(record.checkTime||record.checkDate||'').slice(0,10)}}</p></section><section class="card filters entry-fields"><label v-for="f in fields" :key="f.key">{{f.label}}<input v-model="values[f.key]" :disabled="locked" :inputmode="f.kind==='count'?'numeric':f.kind==='money'?'decimal':'text'" :maxlength="f.kind==='text'?500:24"></label><label class="full-row">更正原因（5至500字）<textarea v-model="reason" :disabled="locked" maxlength="500" rows="3" placeholder="写明发现的问题和更正依据"></textarea></label></section><template v-if="type==='inventory'"><section v-for="line in lines" :key="line.id" class="card filters"><h2 class="full-row">{{line.materialName||'票种明细'}}</h2><label>实盘包数<input v-model="line.invPackageNum" :disabled="locked" inputmode="numeric"></label><label>实盘张数<input v-model="line.invZhangNum" :disabled="locked" inputmode="numeric"></label></section></template><van-button v-if="!pending&&!result" type="primary" block :loading="loading" :disabled="locked" @click="getPreview">预览更正影响</van-button><section v-if="preview" class="card confirm-panel close-submit"><h2>变更与影响</h2><dl><div v-for="(change,index) in labelled(type,preview.changes)" :key="index"><dt>{{change.name}}</dt><dd>{{change.before}} → {{change.after}}</dd></div><div v-for="(impact,index) in labelled(type,preview.impacts)" :key="'impact'+index"><dt>关联影响 · {{impact.name}}</dt><dd>{{impact.before}} → {{impact.after}}</dd></div></dl><h2 class="result-caption">报表 · 更正前 / 更正后</h2><dl><div v-for="r in reports(preview.beforeReport,preview.afterReport)" :key="r.name"><dt>{{r.name}}</dt><dd>{{r.before}} / {{r.after}}</dd></div></dl><p class="intro">{{preview.notice}}</p><van-button type="primary" block :loading="loading" class="close-submit" @click="apply">核对并确认更正</van-button></section><van-button v-if="pending" type="primary" block :loading="loading" class="close-submit" @click="apply">核对并重试原请求</van-button><section v-if="result" class="card success close-submit" role="status"><h2>更正已生效</h2><p>审计编号 {{result.auditId}}</p><p>{{result.reason}}</p><dl><div v-for="r in reports({},result.report)" :key="r.name"><dt>{{r.name}}</dt><dd>{{r.after}}</dd></div></dl></section></template><section class="card close-submit"><van-button :disabled="loading" @click="load">读取最新记录</van-button><h2 class="result-caption">最近更正记录</h2><p v-if="!history.length" class="intro">暂无更正记录</p><dl v-for="audit in history" :key="audit.id"><div><dt>{{String(audit.createdAt||'').replace('T',' ')}}</dt><dd>{{audit.reason}}</dd></div></dl></section></template>
