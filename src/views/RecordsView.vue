<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { request } from '../api/client'
import { loadAccount, allowed, type Department } from '../api/account'
import { resources, getResource, query, recordView, can } from '../domain/resources.js'
import { catalogPermission, type CatalogType } from '../domain/catalog-form'
import { session, isCurrent } from '../api/session'
import { recallRecordQuery, rememberRecordQuery, visibleDepartment, type RecordFilters } from '../domain/record-query'
const route = useRoute(), type = ref(String(route.query.type || ''))
const modules = computed(() => Object.entries(resources).filter(([, r]) => allowed(r.permission)))
const loading = ref(true), initializing = ref(true), error = ref(''), rows = ref<any[]>([]), total = ref(0), pageNo = ref(0), loaded = ref(false)
const notice = ref(''), exporting = ref(false), exportError = ref('')
const keyword = ref(''), start = ref(''), end = ref(''), dept = ref(''), depts = ref<Department[]>([]), summary = ref('')
let filters: RecordFilters = { keyword: '', start: '', end: '', deptId: '' }, controller: AbortController | undefined, version = 0, disposed = false
const canCreate = computed(()=>['materials','costs'].includes(type.value) && allowed(catalogPermission(type.value as CatalogType,'create')))
const resource = computed(() => { try { return type.value ? getResource(type.value) : null } catch { return null } })
onUnmounted(() => { disposed = true; version++; controller?.abort() })
async function initialize() {
  loading.value = true; initializing.value = true; error.value = ''; rows.value = []; loaded.value = false
  try {
    await loadAccount()
    if (disposed) return
    if (type.value && !modules.value.some(([key]) => key === type.value)) throw Error('当前账号没有此记录的查询权限')
    if (!type.value) type.value = modules.value[0]?.[0] || ''
    if (!type.value) { loading.value = false; initializing.value = false; return }
    const saved = recallRecordQuery(session.value!.key, type.value)
    if (saved) { keyword.value = saved.keyword; start.value = saved.start; end.value = saved.end; dept.value = saved.deptId }
    if (resource.value?.dept) depts.value = await request('/sport/boss/departments')
    if (disposed) return
    const visible = resource.value?.dept ? visibleDepartment(dept.value, depts.value) : ''
    if (dept.value && visible !== dept.value) {
      notice.value = '上次查询的门店已不在当前可见范围，请重新选择门店后查询。'
      dept.value = ''; initializing.value = false; loading.value = false; return
    }
    dept.value = visible
    initializing.value = false; loading.value = false; await load(true)
  } catch (e) { if (!disposed) { error.value = (e as Error).message; loading.value = false } }
}
async function changeType() {
  exportError.value = ''; version++; controller?.abort(); rows.value = []; total.value = 0; loaded.value = false; keyword.value = ''; start.value = ''; end.value = ''; dept.value = ''; depts.value = []; notice.value = ''
  if (session.value) rememberRecordQuery(session.value.key, type.value, { keyword: '', start: '', end: '', deptId: '' })
  await initialize()
}
async function load(reset: boolean) {
  if (!resource.value || loading.value) return
  const current = ++version
  controller?.abort(); controller = new AbortController()
  loading.value = true; error.value = ''; notice.value = ''
  if (reset) { rows.value = []; loaded.value = false; total.value = 0; filters = { keyword: keyword.value, start: start.value, end: end.value, deptId: dept.value } }
  const next = reset ? 1 : pageNo.value + 1
  try {
    const result = await request((resource.value.queryBase || resource.value.base) + '/page', { data: query(type.value, filters, next), signal: controller.signal })
    if (disposed || current !== version) return
    if (!Array.isArray(result?.list) || !Number.isInteger(Number(result.total)) || Number(result.total) < 0) throw Error('列表数据不完整')
    const info = await request('/system/auth/get-permission-info', { signal: controller.signal })
    if (disposed || current !== version) return
    const items = result.list.map((row: any) => ({ ...recordView(type.value, row), canOpen: recordView(type.value, row).canOpen && can(info.permissions, resource.value!.detailPermission || resource.value!.permission) }))
    rows.value = reset ? items : [...rows.value, ...items]; total.value = Number(result.total); pageNo.value = next; loaded.value = true
    if (session.value) rememberRecordQuery(session.value.key, type.value, filters)
    summary.value = [depts.value.find(d => String(d.id) === filters.deptId)?.name || '全部可见门店', filters.start ? filters.start + ' 至 ' + filters.end : '全部日期', filters.keyword].filter(Boolean).join(' · ')
  } catch (e) { if (!disposed && current === version) error.value = (e as Error).message }
  finally { if (!disposed && current === version) loading.value = false }
}
async function exportCommission() {
  const login=session.value?.key, currentVersion=version
  if (!login || loading.value || exporting.value || !loaded.value || type.value!=='commission' || !allowed('sport:check-game-sales:export')) return
  exporting.value=true
  exportError.value=''
  try {
    const data={deptId:filters.deptId,start:filters.start,end:filters.end}
    const blob=await request<Blob>('/sport/boss/admin-ledger/commission/export',{data,responseType:'csv'})
    if (disposed || currentVersion!==version || !isCurrent(login)) return
    const url=URL.createObjectURL(blob), link=document.createElement('a')
    link.href=url;link.download='返佣盘点.csv';link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  } catch (failure) {
    if (!disposed && currentVersion===version && isCurrent(login)) exportError.value=(failure as Error).message
  } finally { exporting.value=false }
}
function retry() { if (initializing.value) initialize(); else load(!loaded.value) }
function reset() { keyword.value = ''; start.value = ''; end.value = ''; dept.value = ''; load(true) }
onMounted(initialize)
</script>
<template><div class="page-title"><p class="eyebrow">RECORDS / 经营记录</p><h1>{{ resource?.title || '经营记录' }}</h1><van-button v-if="loaded && type==='commission' && allowed('sport:check-game-sales:export')" plain :disabled="loading || exporting" @click="exportCommission">导出当前返佣查询</van-button><p v-if="exportError" class="error" role="alert">{{ exportError }}</p><p class="intro">先选范围，再查看记录。所有查询受账号权限约束。</p></div><section v-if="modules.length" class="card filters"><label>业务类型<select v-model="type" :disabled="loading" @change="changeType"><option v-for="[key, item] in modules" :key="key" :value="key">{{ item.title }}</option></select></label><label v-if="resource?.dept">门店<select v-model="dept" :disabled="loading"><option value="">全部可见门店</option><option v-for="d in depts" :key="d.id" :value="String(d.id)">{{ d.name }}</option></select></label><label v-if="resource?.searchField">关键词<input v-model="keyword" :disabled="loading" placeholder="输入账号或名称"></label><div class="date-range"><label>开始日期<input v-model="start" type="date" :disabled="loading"></label><label>结束日期<input v-model="end" type="date" :disabled="loading"></label></div><div class="actions"><van-button block type="primary" :loading="loading" @click="load(true)">查询</van-button><van-button :disabled="loading" @click="reset">重置</van-button></div></section><router-link v-if="canCreate" :to="'/catalog/' + type + '/new'" class="module-card quick-link"><strong>新增{{resource?.title}}</strong><span>核对后保存 ↗</span></router-link><van-notice-bar v-if="notice" wrapable :text="notice" /><section v-if="error" class="card error" role="alert">{{ error }}<van-button plain type="primary" @click="retry">重试读取</van-button></section><p v-if="loaded" class="result-caption">已加载 {{ rows.length }} / {{ total }} 条 · {{ summary }}<small>修改条件后点击查询；加载更多沿用上次查询范围。</small></p><section v-for="row in rows" :key="row.id" class="card"><h2>{{ row.title }}</h2><dl><div v-for="field in row.fields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></dl><router-link v-if="row.canOpen" :to="'/records/' + type + '/' + row.id" class="text-link">查看完整详情 →</router-link></section><section v-if="loading" class="card state"><van-loading />正在读取记录</section><van-empty v-if="!loading && !error && !rows.length" description="当前范围暂无记录" /><van-button v-if="loaded && rows.length < total" block plain type="primary" :loading="loading" @click="load(false)">加载更多</van-button></template>
