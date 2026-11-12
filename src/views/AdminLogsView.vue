<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { allowed, identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

type Kind = 'login' | 'operate'
type Row = Record<string, string | null>
const login = session.value?.key
let disposed = false
const current = () => !disposed && !!login && isCurrent(login)
onUnmounted(() => { disposed = true })
const kind = ref<Kind>('login')
const permission = (target: Kind, action: string) => allowed('system:' + (target === 'login' ? 'login-log' : 'operate-log') + ':' + action)
const types = computed(() => (['login','operate'] as const).filter(type => permission(type,'query')))
const title = (type: Kind) => type === 'login' ? '登录日志' : '操作日志'
const columns = computed(() => kind.value === 'login'
  ? [['id','编号'],['user_id','账号编号'],['log_type','登录类型'],['result','结果码'],['create_time','时间']]
  : [['id','编号'],['user_id','账号编号'],['type','类型'],['sub_type','操作'],['request_method','请求方法'],['create_time','时间']])
const extraLabels: Record<string,string> = {
  username:'账号', user_type:'账号类型', user_ip:'IP 地址', user_agent:'客户端', trace_id:'追踪编号',
  biz_id:'业务编号', action:'操作摘要', extra:'补充信息', request_url:'请求路径',
}
const rows = ref<Row[]>([]), detail = ref<Row>()
const page = ref(1), total = ref(0)
const busy = ref(false), error = ref('')
const filters = ref<Record<string,string>>({})
let applied: Record<string,string> = {}
const base = '/system/admin-native/platform/logs/'
const basicFilters = computed(() => kind.value === 'login'
  ? [['username','账号'],['keyword','结果码'],['userIp','IP 地址'],['userId','账号编号']]
  : [['keyword','类型关键词'],['type','类型'],['subType','操作'],['action','操作摘要'],['bizId','业务编号'],['userIp','IP 地址'],['userId','账号编号']])
const valueText = (value: string | null | undefined) => value == null || value === '' ? '—' : value

async function perform(operation: () => Promise<void>) {
  if (busy.value || !current()) return
  busy.value = true
  error.value = ''
  try { await operation() }
  catch (failure) { if (current()) error.value = (failure as Error).message }
  finally { if (current()) busy.value = false }
}
async function readPage(next: number, query = applied) {
  const selected = kind.value
  if (!permission(selected,'query')) return
  if (query.startDate && query.endDate && query.startDate > query.endDate) throw Error('结束日期不能早于开始日期')
  if (query.userId) identityId(query.userId)
  if (query.bizId) identityId(query.bizId)
  if (selected === 'login' && query.keyword && !/^\d{1,6}$/.test(query.keyword)) throw Error('登录结果码须为 1 至 6 位数字')
  const response = await request<{list: Row[]; total:number}>(base + selected,{data:{...query,pageNo:next,pageSize:20}})
  if (!current() || selected !== kind.value) return
  if (!Array.isArray(response?.list) || !Number.isSafeInteger(response.total) || response.total<0) throw Error('日志列表返回格式不完整')
  rows.value = response.list
  total.value = response.total
  page.value = next
  applied = query
  detail.value = undefined
}
function select(type: Kind) {
  return perform(async () => {
    kind.value = type
    rows.value = []
    detail.value = undefined
    filters.value = {}
    applied = {}
    total.value = 0
    page.value = 1
    await readPage(1)
  })
}
function search() {
  return perform(() => readPage(1,Object.fromEntries(Object.entries(filters.value).map(([key,value])=>[key,value.trim()]))))
}
function readDetail(row: Row) {
  return perform(async () => {
    detail.value = undefined
    const result = await request<Row>(base + kind.value + '/get',{data:{id:identityId(row.id)}})
    if (current()) detail.value = result
  })
}
function download() {
  return perform(async () => {
    const selected=kind.value
    if (!permission(selected,'export') || !rows.value.length) return
    const csv=await request<string>('/system/admin-native/exports/'+selected,{data:applied})
    if(!current())return
    if(typeof csv!=='string')throw Error('导出回执不完整')
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'})), link=document.createElement('a')
    link.href=url;link.download=title(selected)+'.csv';link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  })
}
onMounted(async () => {
  await perform(async () => { if (!identity.value) await loadAccount() })
  const first = types.value[0]
  if (first) await select(first)
})
</script>

<template>
  <div class="page-title"><h1>组织日志</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="!busy && !types.length" class="card">当前账号没有日志查询权限。</p>
  <template v-if="types.length">
    <section class="card">
      <van-button v-for="type in types" :key="type" :type="kind===type?'primary':'default'" :disabled="busy" @click="select(type)">{{ title(type) }}</van-button>
      <form @submit.prevent="search">
        <van-field v-for="[key,label] in basicFilters" :key="key" v-model="filters[key]" :label="label" maxlength="100" :disabled="busy"/>
        <div class="date-range">
          <label>开始日期<input v-model="filters.startDate" type="date" :disabled="busy"></label>
          <label>结束日期<input v-model="filters.endDate" type="date" :disabled="busy"></label>
        </div>
        <van-button native-type="submit" :disabled="busy">查询</van-button>
      </form>
    </section>
    <section class="card">
      <van-empty v-if="!busy && !rows.length" description="没有匹配日志"/>
      <article v-for="row in rows" :key="row.id??''" class="log-row">
        <dl><div v-for="[key,label] in columns" :key="key"><dt>{{ label }}</dt><dd>{{ valueText(row[key]) }}</dd></div></dl>
        <van-button size="small" :disabled="busy" @click="readDetail(row)">查看日志</van-button>
      </article>
      <van-button size="small" :disabled="busy || page<=1" @click="perform(() => readPage(page-1))">上一页</van-button>
      <span> 第 {{ page }} 页 / 共 {{ total }} 条 </span>
      <van-button size="small" :disabled="busy || page*20>=total || page>=100000" @click="perform(() => readPage(page+1))">下一页</van-button>
      <van-button v-if="permission(kind,'export') && rows.length" size="small" :disabled="busy" @click="download">导出查询结果 CSV</van-button>
    </section>
    <section v-if="detail" class="card">
      <h2>日志详情</h2>
      <dl>
        <div v-for="[key,label] in columns" :key="key"><dt>{{ label }}</dt><dd>{{ valueText(detail[key]) }}</dd></div>
        <template v-for="(label,key) in extraLabels" :key="key">
          <div v-if="key in detail"><dt>{{ label }}</dt><dd>{{ valueText(detail[key]) }}</dd></div>
        </template>
      </dl>
    </section>
  </template>
</template>

<style scoped>
.log-row { border-bottom: 1px solid #dce4ef; padding: 12px 0; }
dd { overflow-wrap: anywhere; }
</style>
