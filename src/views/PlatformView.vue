<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { session } from '../api/session'
type Kind = 'tenants' | 'packages'
type Row = { id: string; name: string; status: number }
const kind = ref<Kind>('tenants'), page = ref(1), total = ref(0), search = ref(''), applied = ref('')
const rows = ref<Row[]>([]), busy = ref(false), error = ref('')
const authorized = computed(() => !!session.value && identity.value?.permissions.includes('*:*:*'))
const detail = ref<{ name: string; fields: { label: string; value: string }[] } | null>(null)
const detailBusy = ref(false), detailError = ref('')
let serial = 0, detailSerial = 0
function closeDetail() { detailSerial++; detail.value = null; detailBusy.value = false; detailError.value = '' }
async function openDetail(row: Row) {
  closeDetail()
  if (!authorized.value) return
  const token = detailSerial, resource = kind.value
  detailBusy.value = true
  try {
    const data = await request('/system/admin-native/platform/' + resource + '/get', { data: { id: row.id } })
    if (token !== detailSerial || !authorized.value) return
    if (data?.id !== row.id || typeof data.name !== 'string' || ![0, 1].includes(data.status)) throw Error('平台详情返回格式不完整')
    const fields = [{ label: '状态', value: data.status === 0 ? '启用' : '停用' }]
    if (resource === 'tenants') {
      fields.push({ label: '组织类型', value: data.systemTenant === true ? '系统组织' : '客户组织' })
      if (typeof data.expireTime === 'string' && data.expireTime) fields.push({ label: '有效期', value: data.expireTime.replace('T', ' ') })
      if (Number.isSafeInteger(data.accountCount)) fields.push({ label: '账号配额', value: String(data.accountCount) })
    } else if (Array.isArray(data.menuIds)) fields.push({ label: '配置菜单数', value: String(data.menuIds.length) })
    detail.value = { name: data.name, fields }
  } catch (err) { if (token === detailSerial) detailError.value = (err as Error).message }
  finally { if (token === detailSerial) detailBusy.value = false }
}
function clear() { closeDetail(); serial++; rows.value = []; total.value = 0; busy.value = false; error.value = '' }
watch(() => session.value?.key, clear, { flush: 'sync' })
onUnmounted(clear)
async function load() {
  clear()
  if (!authorized.value) return
  const token = serial
  busy.value = true
  try {
    const data = await request('/system/admin-native/platform/' + kind.value + '/page', { data: { pageNo: page.value, pageSize: 20, search: applied.value } })
    if (token !== serial || !authorized.value) return
    if (!Array.isArray(data?.list) || !Number.isSafeInteger(data.total) || data.total < 0 || data.list.some((r: Row) => !r || typeof r.id !== 'string' || !/^\d+$/.test(r.id) || typeof r.name !== 'string' || ![0,1].includes(r.status))) throw Error('平台列表返回格式不完整')
    rows.value = data.list; total.value = data.total
  } catch (err) { if (token === serial) error.value = (err as Error).message }
  finally { if (token === serial) busy.value = false }
}
async function initialize() {
  const key = session.value?.key
  busy.value = true
  try { await loadAccount(); if (key === session.value?.key) await load() }
  catch (err) { if (key === session.value?.key) error.value = (err as Error).message }
  finally { if (key === session.value?.key) busy.value = false }
}
function filter() { page.value = 1; applied.value = search.value.trim(); void load() }
function choose(value: Kind) { kind.value = value; search.value = ''; filter() }
onMounted(initialize)
</script>

<template>
  <div class="page-title"><h1>平台管理</h1><p class="intro">查看组织及套餐状态。</p></div>
  <section v-if="error" role="alert" class="card error">{{ error }}</section>
  <van-loading v-if="busy" />
  <van-empty v-else-if="!authorized && !error" description="此功能仅对平台管理员开放" />
  <template v-if="authorized">
    <section class="card">
      <van-button :type="kind === 'tenants' ? 'primary' : 'default'" @click="choose('tenants')">组织</van-button>
      <van-button :type="kind === 'packages' ? 'primary' : 'default'" @click="choose('packages')">套餐</van-button>
      <form @submit.prevent="filter">
        <van-field v-model="search" maxlength="100" label="名称" placeholder="搜索名称" />
        <van-button native-type="submit" :disabled="busy">搜索</van-button>
      </form>
    </section>
    <section class="card">
      <van-empty v-if="!busy && !error && !rows.length" description="没有匹配记录" />
      <van-cell v-for="row in rows" :key="row.id" :title="row.name" :value="row.status === 0 ? '启用' : '停用'" is-link @click="openDetail(row)" />
      <van-button :disabled="busy || page <= 1" @click="page--; load()">上一页</van-button>
      <span> 第 {{ page }} 页 / 共 {{ total }} 条 </span>
      <van-button :disabled="busy || page * 20 >= total || page >= 100000" @click="page++; load()">下一页</van-button>
    </section>
    <van-loading v-if="detailBusy" />
    <section v-if="detailError" class="card error" role="alert">{{ detailError }}</section>
    <section v-if="detail" class="card">
      <h2>{{ detail.name }}</h2>
      <dl><div v-for="field in detail.fields" :key="field.label"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></dl>
      <van-button @click="closeDetail">关闭详情</van-button>
    </section>
  </template>
</template>
