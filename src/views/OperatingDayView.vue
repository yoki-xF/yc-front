<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, loadAccount, type Department } from '../api/account'
import { ApiError, request } from '../api/client'
import { session } from '../api/session'
import { operatingDay, closingPreview, readDayCommand, commandStorageKey, type Day, type DayCommand } from '../domain/operating-day'
const depts = ref<Department[]>([]), dept = ref(''), day = ref<Day | null>(null), preview = ref<ReturnType<typeof closingPreview> | null>(null)
const loading = ref(false), ready = ref(false), error = ref(''), success = ref(''), pending = ref<DayCommand | null>(null), blocked = ref(false)
const fundNames: Record<string,string> = {xj:'现金',wxBalance:'微信',hsk:'汇收款',zfb:'支付宝',szRmb:'数字人民币'}
const reportNames: Record<string,string> = {openingFunds:'早班五类资金',closingFunds:'晚班五类资金',reserveIn:'备付金转入',instantSales:'即开销量',electronicSales:'电彩销量',sportsBettingSales:'竞彩销量',totalSales:'总销量',adjustments:'资金调整合计',wrongTicket:'错票（单列）',variance:'门店资金账差'}
let disposed = false, controller: AbortController | undefined
onUnmounted(() => { disposed = true; controller?.abort() })
function storageKey() { if (!session.value) throw Error('请重新登录'); return commandStorageKey(session.value.key, dept.value) }
async function initialize() {
  loading.value = true; error.value = ''
  try { await loadAccount(); if (disposed) return; if (!allowed('sport:business-day:query')) throw Error('当前账号没有营业日查看权限'); const options = await request<Department[]>('/sport/boss/departments'); if (disposed) return; depts.value = options; dept.value = String(options[0]?.id || ''); ready.value = true }
  catch (e) { if (!disposed) error.value = (e as Error).message }
  finally { if (!disposed) loading.value = false }
  if (!disposed && dept.value) await load()
}
async function load() {
  if (loading.value) return
  loading.value = true; error.value = ''; day.value = null; preview.value = null; pending.value = null; blocked.value = false
  controller?.abort(); controller = new AbortController()
  try {
    if (!depts.value.some(d => String(d.id) === dept.value)) throw Error('请选择有管理权限的门店')
    try { pending.value = readDayCommand(sessionStorage.getItem(storageKey()), dept.value) } catch (e) { blocked.value = true; throw e }
    const raw = await request('/sport/business-day/current', {data:{deptId:dept.value},signal:controller.signal})
    if (!disposed) day.value = operatingDay(raw, dept.value)
  } catch (e) { if (!disposed) error.value = (e as Error).message }
  finally { if (!disposed) loading.value = false }
}
async function getPreview() {
  if (loading.value || !day.value || pending.value || blocked.value) return
  loading.value = true; error.value = ''; preview.value = null; success.value = ''
  try { const raw = await request('/sport/business-day/closing-preview',{data:{deptId:dept.value}}); if (!disposed) preview.value = closingPreview(raw,day.value!) }
  catch (e) { if (!disposed) error.value = (e as Error).message }
  finally { if (!disposed) loading.value = false }
}
async function submit(action: 'open'|'close', retry = false) {
  if (loading.value || !day.value || blocked.value || !allowed(`sport:business-day:${action}`)) return
  if (!retry && (pending.value || (action === 'open' ? day.value.status !== 'NOT_OPEN' : !preview.value || day.value.status !== 'OPEN'))) return
  loading.value = true; error.value = ''; success.value = ''
  try {
    await showConfirmDialog({title: retry ? '核对并重试原请求' : action === 'open' ? '确认开店' : '确认结店', message: retry ? '将使用原请求标识重新提交，服务器会核对是否已完成。请勿另开页面重复操作。' : action === 'open' ? '确认所选门店已准备营业？营业日由服务器按北京时间确定。' : '确认五类资金及销量已核对？结店后调整必须通过留痕更正。',confirmButtonText:retry?'重试原请求':action==='open'?'确认开店':'确认结店'})
    if (disposed) return
    if (!retry) {
      const data: DayCommand['data'] = {deptId:dept.value,requestKey:crypto.randomUUID()}
      if (action === 'close') Object.assign(data,{dayId:day.value.id,revision:Number(day.value.revision),sourceRevision:preview.value!.sourceRevision})
      const command: DayCommand = {action,data}
      // Save before sending. A network failure must not create a new write request on refresh.
      sessionStorage.setItem(storageKey(),JSON.stringify(command)); pending.value = command
    }
    const command = pending.value!
    const raw = await request(`/sport/business-day/${command.action}`,{method:'POST',data:command.data})
    if (disposed) return
    const result = operatingDay(raw,dept.value)
    if (command.action === 'close' && (result.id !== command.data.dayId || result.status !== 'CLOSED')) throw Error('结店结果不一致，请保留请求并联系管理员核对')
    sessionStorage.removeItem(storageKey()); pending.value = null; preview.value = null; day.value = result
    success.value = result.status === 'CLOSED' ? '该营业日已结店。可以前往门店报表查看核算结果。' : '开店已确认，员工可以按当前营业日录入业务。'
  } catch (e) { if (!disposed && e !== 'cancel' && e !== 'close') { error.value = (e as Error).message || '提交未确认，请先核对当前状态'; preview.value = null; if (e instanceof ApiError && [400,403,10086].includes(e.code || 0)) { sessionStorage.removeItem(storageKey()); pending.value = null } } }
  finally { if (!disposed) loading.value = false }
}
onMounted(initialize)
</script>
<template><div class="page-title"><p class="eyebrow">BUSINESS DAY / 营业日</p><h1>开店有序，结店有据</h1><p class="intro">跨午夜仍归开店当天。结店前由服务器重新核对库存、单据和资金。</p></div><section v-if="ready && depts.length" class="card filters"><label>管理门店<select v-model="dept" :disabled="loading" @change="success = ''; load()"><option v-for="d in depts" :key="d.id" :value="String(d.id)">{{d.name}}</option></select></label><van-button :loading="loading" block @click="load">刷新营业日状态</van-button></section><van-empty v-if="ready && !depts.length" description="暂无可管理的门店" /><section v-if="error" class="card error" role="alert">{{error}}<van-button v-if="!ready" :disabled="loading" @click="initialize">重试读取</van-button></section><section v-if="success" class="card success" role="status">{{success}}<router-link v-if="day?.status === 'CLOSED'" to="/reports" class="text-link">查看门店报表 ↗</router-link></section><van-notice-bar v-if="pending" wrapable text="上一笔提交尚未确认。请先刷新核对状态；需要重试时只发送原请求，避免重复开店或结店。" /><section v-if="day" class="card"><div class="day-status"><h2>{{day.businessDate}}</h2><span class="status-pill" :class="{open:day.status === 'OPEN'}">{{{OPEN:'营业中',NOT_OPEN:'当前无进行中营业日',CLOSED:'已结店'}[day.status]}}</span></div><p class="intro" v-if="day.status === 'NOT_OPEN'">当前没有进行中的营业日。当日已结店时不能再次开店；新门店须先完成初始资金和库存设置。</p><p v-else class="intro">{{day.status === 'OPEN' ? '所有员工共用当前营业日，跨午夜无需重复开店。' : '后续账务调整需要更正原因与审计记录。'}}</p><div v-if="!pending && !blocked" class="button-stack"><van-button v-if="day.status === 'NOT_OPEN' && allowed('sport:business-day:open')" type="primary" :loading="loading" block @click="submit('open')">确认开店</van-button><van-button v-if="day.status === 'OPEN' && allowed('sport:business-day:close')" type="primary" :loading="loading" block @click="getPreview">核对结店预览</van-button></div><van-button v-if="pending && allowed('sport:business-day:' + pending.action)" block :loading="loading" @click="submit(pending.action,true)">核对并重试原请求</van-button></section><section v-if="preview" class="card confirm-panel"><h2>结店预览 · 元</h2><p class="intro">请逐项核对。预览后若单据有变化，服务器会要求重新预览。</p><dl><div v-for="(value,key) in preview.report" :key="key"><dt>{{reportNames[key]}}</dt><dd>{{value}}</dd></div></dl><h2 class="result-caption">五类资金 · 早班 / 晚班</h2><dl><div v-for="fund in preview.funds" :key="fund.key"><dt>{{fundNames[fund.key]}}</dt><dd>{{fund.opening}} / {{fund.closing}}</dd></div></dl><van-button class="close-submit" type="primary" block :loading="loading" @click="submit('close')">确认核对并结店</van-button></section><section v-if="loading && !day" class="card state"><van-loading />正在读取营业日</section></template>
