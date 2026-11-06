<script setup lang="ts">
import {onMounted,onUnmounted,ref} from 'vue'
import {useRoute} from 'vue-router'
import {departments,identity,loadAccount,employeeScopeError} from '../api/account'
import {request} from '../api/client'
import {employeeDay} from '../domain/employee-entry'
import {checkRows} from '../domain/check-status'
const route=useRoute(),dept=ref(String(route.query.deptId||'')),loading=ref(false),error=ref(''),date=ref(''),notOpen=ref(false),rows=ref<ReturnType<typeof checkRows>>([])
let disposed=false,controller:AbortController|undefined
onUnmounted(()=>{disposed=true;controller?.abort()})
async function initialize(){loading.value=true;error.value='';try{await loadAccount();if(disposed)return;if(employeeScopeError.value)throw Error(employeeScopeError.value);if(!departments.value.some(d=>d.id===dept.value))dept.value=departments.value[0]?.id||''}catch(e){if(!disposed)error.value=(e as Error).message}finally{if(!disposed)loading.value=false}if(!disposed&&dept.value)await load()}
async function load(){
 if(loading.value)return;loading.value=true;error.value='';rows.value=[];notOpen.value=false;date.value='';controller?.abort();controller=new AbortController()
 try{
  if(!departments.value.some(d=>d.id===dept.value))throw Error('请选择已授权的员工门店')
  const options={data:{deptId:dept.value},signal:controller.signal},actor=String(identity.value!.user.id)
  const raw=await request('/sport/wx/store/operating-day',options)
  if(raw?.status==='NOT_OPEN'&&raw.deptId===dept.value&&raw.actorId===actor){if(!disposed)notOpen.value=true;return}
  const day=employeeDay(raw,dept.value,actor)
  const status=await request('/sport/wx/isGenDeptData',options)
  const after=employeeDay(await request('/sport/wx/store/operating-day',options),dept.value,actor)
  if(after.id!==day.id)throw Error('营业日已变化，请重新读取盘点进度')
  if(!disposed){rows.value=checkRows(status,dept.value);date.value=day.date}
 }catch(e){if(!disposed)error.value=(e as Error).message}finally{if(!disposed)loading.value=false}
}
onMounted(initialize)
</script>
<template><div class="page-title"><p class="eyebrow">DAILY CHECK / 盘点进度</p><h1>今日还差哪一步</h1><p class="intro">查看当前营业日记录状态，所有项目提交后仍需有权限人员核对结店。</p></div><section v-if="departments.length" class="card filters"><label>员工门店<select v-model="dept" :disabled="loading" @change="load"><option v-for="d in departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><van-button :loading="loading" @click="load">刷新进度</van-button></section><section v-if="error" class="card error" role="alert">{{error}}<van-button :disabled="loading" @click="departments.length?load():initialize()">重新读取</van-button></section><section v-if="loading" class="card state"><van-loading />正在核对营业日</section><section v-if="notOpen" class="card"><h2>当前没有进行中营业日</h2><p class="intro">门店尚未开店或已经结店。需要开始营业时请联系有权限人员；历史销量可在个人报表查看。</p><router-link class="text-link" to="/personal-report">查看个人销量 ↗</router-link></section><template v-if="rows.length"><p class="result-caption">营业日 {{date}} · 状态以本次读取为准</p><section v-for="row in rows" :key="row.key" class="card"><div class="day-status"><h2>{{row.label}}</h2><span class="status-pill" :class="{open:row.required&&row.done}">{{row.state}}</span></div><router-link v-if="row.required" class="text-link" :to="row.to">{{row.done?'查看与核对记录':'前往填写'}} ↗</router-link></section><van-notice-bar wrapable text="已提交只表示存在记录，不代表金额已核对或门店已结店。结店由服务器检查完整盘点、待确认单据及资金。" /></template><van-empty v-if="!loading&&!error&&!departments.length" description="暂无员工门店授权" /></template>
