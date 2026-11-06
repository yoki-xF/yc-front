<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { loadAccount, departments, identity, employeeScopeError } from '../api/account'
import { request } from '../api/client'
import { period } from '../domain/report-period.js'
import { days } from '../domain/reporting.js'
import { employeeReport } from '../domain/employee-report'
const dept = ref(''), start = ref(period('day').start), end = ref(start.value)
const ready = ref(false), loading = ref(false), error = ref(''), report = ref<ReturnType<typeof employeeReport> | null>(null), range = ref('')
let disposed = false, controller: AbortController | undefined
onUnmounted(() => { disposed = true; controller?.abort() })
function preset(kind: string) { const value = period(kind); start.value = value.start; end.value = value.end; report.value = null }
async function initialize() {
  loading.value = true; error.value = ''
  try { await loadAccount(); if (disposed) return; if (employeeScopeError.value) throw Error(employeeScopeError.value); dept.value = departments.value[0]?.id || ''; ready.value = true }
  catch (e) { if (!disposed) error.value = (e as Error).message }
  finally { if (!disposed) loading.value = false }
  if (!disposed && dept.value) await load()
}
async function load() {
  if (loading.value) return
  report.value = null; error.value = ''; loading.value = true
  controller?.abort(); controller = new AbortController()
  try {
    if (!departments.value.some(d => d.id === dept.value)) throw Error('请选择已授权的员工门店')
    const scope = { deptId: dept.value, actorId: String(identity.value!.user.id), start: start.value, end: end.value }
    days(scope.start, scope.end)
    const raw = await request('/sport/wx/store/unified-report', { data: { deptId: scope.deptId, start: scope.start, end: scope.end }, signal: controller.signal })
    if (!disposed) { report.value = employeeReport(raw, scope); range.value = scope.start + ' 至 ' + scope.end }
  } catch (e) { if (!disposed) error.value = (e as Error).message }
  finally { if (!disposed) loading.value = false }
}
onMounted(initialize)
</script>
<template><div class="page-title"><p class="eyebrow">MY SALES / 个人销量</p><h1>我的销量</h1><p class="intro">只统计本人电彩、竞彩销量；即开和盈亏由门店统一核算。</p></div><section v-if="ready && departments.length" class="card filters"><label>员工门店<select v-model="dept" :disabled="loading" @change="report = null"><option v-for="d in departments" :key="d.id" :value="d.id">{{ d.name }}</option></select></label><div class="period-switch" role="group" aria-label="日期快捷选择"><van-button :disabled="loading" @click="preset('day')">今日</van-button><van-button :disabled="loading" @click="preset('week')">本周</van-button><van-button :disabled="loading" @click="preset('month')">本月</van-button></div><div class="date-range"><label>开始日期<input v-model="start" type="date" :disabled="loading" @change="report = null"></label><label>结束日期<input v-model="end" type="date" :disabled="loading" @change="report = null"></label></div><van-button block type="primary" :loading="loading" @click="load">查询个人销量</van-button></section><section v-if="error" class="card error" role="alert">{{ error }}<van-button :disabled="loading" @click="ready ? load() : initialize()">重试读取</van-button></section><section v-if="loading" class="card state"><van-loading />正在读取个人销量</section><van-empty v-if="ready && !departments.length" description="暂无员工门店授权，请联系管理员" /><template v-if="report"><section class="hero"><span>{{ range }} · 元</span><div class="metrics metrics-two"><div><span>个人电彩</span><strong>{{ report.electronic }}</strong></div><div><span>个人竞彩</span><strong>{{ report.sports }}</strong></div></div><p>已核对 {{ report.fresh }} 个营业日，其他状态 {{ report.pending }} 个。</p></section><van-notice-bar wrapable text="合计仅包含已结店且已核对的营业日。营业中、待核对和未营业日期不计入合计；跨午夜归开店当天。" /><section v-for="row in report.rows" :key="row.date" class="card"><h2>{{ row.date }} · {{ row.status }}</h2><dl><div><dt>个人电彩</dt><dd>{{ row.electronic }}</dd></div><div><dt>个人竞彩</dt><dd>{{ row.sports }}</dd></div></dl></section></template></template>
