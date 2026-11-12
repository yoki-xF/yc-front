<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { loadAccount, allowed, departments, type Department } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { normalize, days, reportCsv } from '../domain/reporting.js'
const canManage = ref<boolean | null>(null)
const loading = ref(true), ready = ref(false), error = ref(''), depts = ref<Department[]>([]), dept = ref(''), report = ref<any>(null)
const today = new Date(), date = [today.getFullYear(), String(today.getMonth()+1).padStart(2,'0'), String(today.getDate()).padStart(2,'0')].join('-')
const start = ref(date), end = ref(date), range = ref('')
const login = session.value?.key
let disposed = false, controller: AbortController | undefined
onUnmounted(() => { disposed = true; controller?.abort() })
async function initialize() {
  loading.value = true; ready.value = false; error.value = ''
  try { await loadAccount(); canManage.value = allowed('sport:check-ggl:query') || allowed('sport:check-service:query'); if (!canManage.value) return; depts.value = await request('/sport/boss/departments'); if (disposed) return; ready.value = true; loading.value = false; await load() }
  catch (e) { if (!disposed) { error.value = (e as Error).message; loading.value = false } }
  finally { if (!disposed && !canManage.value) loading.value = false }
}
async function load() {
  if (!ready.value || loading.value) return
  loading.value = true; error.value = ''; report.value = null
  controller?.abort(); controller = new AbortController()
  try {
    days(start.value, end.value)
    const filters = { start: start.value, end: end.value, ...(dept.value ? { deptId: dept.value } : {}) }
    const raw = await request('/sport/boss/reports', { data: { schemaVersion: 2, ...filters }, signal: controller.signal })
    if (disposed) return
    report.value = normalize(raw, filters); range.value = filters.start + ' 至 ' + filters.end
  } catch (e) { if (!disposed) error.value = (e as Error).message } finally { if (!disposed) loading.value = false }
}
function download() {
  if (!report.value || !login || !isCurrent(login) || !canManage.value) return
  const url = URL.createObjectURL(new Blob([reportCsv(report.value, range.value)], {type:'text/csv;charset=utf-8'}))
  const link = document.createElement('a')
  link.href = url
  link.download = '门店经营日报 ' + range.value + '.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
onMounted(initialize)
</script>
<template><div class="page-title"><p class="eyebrow">REPORTS / 门店经营</p><h1>每一笔，清楚有据</h1><p class="intro">门店统一核算资金与盈亏；跨午夜归开店当天。</p></div><router-link v-if="departments.length" to="/personal-report" class="module-card"><strong>我的销量</strong><span>查看本人电彩、竞彩销量 ↗</span></router-link><van-empty v-if="canManage === false && !departments.length" description="暂无可查看的报表，请联系管理员配置门店和权限" /><section v-if="ready" class="card filters"><label>门店<select v-model="dept" :disabled="loading"><option value="">全部可见门店</option><option v-for="d in depts" :key="d.id" :value="String(d.id)">{{ d.name }}</option></select></label><div class="date-range"><label>开始日期<input v-model="start" type="date" :disabled="loading"></label><label>结束日期<input v-model="end" type="date" :disabled="loading"></label></div><van-button block type="primary" :loading="loading" @click="load">查询报表</van-button></section><section v-if="error" class="card error" role="alert">{{ error }}<van-button @click="ready ? load() : initialize()">重试读取</van-button></section><section v-if="loading" class="card state"><van-loading />正在读取已核对营业日</section><template v-if="report"><van-button plain @click="download">下载当前报表 CSV</van-button><section class="hero"><span>已核对营业日销量 · 元</span><div class="big-number">{{ report.summary.totalSales }}</div><p>{{ range }}</p><div class="metrics"><div><span>即开</span><strong>{{ report.summary.instantSales }}</strong></div><div><span>电彩</span><strong>{{ report.summary.electronicSales }}</strong></div><div><span>竞彩</span><strong>{{ report.summary.sportsBettingSales }}</strong></div></div></section><section class="card"><dl><div><dt>门店资金账差</dt><dd>{{ report.summary.variance }} 元</dd></div><div><dt>错票（单列）</dt><dd>{{ report.summary.wrongTicket }} 元</dd></div></dl><p class="intro">已核对 {{ report.summary.freshDays }} 个门店营业日，待核对 {{ report.summary.pendingDays }} 个，未营业 {{ report.summary.notOpenDays }} 个。</p></section><van-notice-bar v-if="report.summary.pendingDays" wrapable text="合计仅包含已核对营业日；存在待核对日期的门店不参与排名。" /><section v-for="row in report.rows" :key="row.deptId" class="card"><h2>{{ row.deptName }}</h2><dl><div><dt>总销量</dt><dd>{{ row.sales }}</dd></div><div><dt>资金账差</dt><dd>{{ row.variance }}</dd></div><div><dt>已核对 / 待核对 / 未营业</dt><dd>{{ row.freshDays }} / {{ row.pendingDays }} / {{ row.notOpenDays }}</dd></div></dl></section><van-empty v-if="!report.rows.length" description="当前范围暂无门店数据" /></template></template>
