<script setup lang="ts">
import { computed, onUnmounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { request } from '../api/client'
import { session } from '../api/session'
import { catalogFields, catalogId, catalogPayload, catalogType, catalogValues, requireCatalogPermission, type CatalogDepartment, type CatalogValues } from '../domain/catalog-form'
const route = useRoute()
const type = computed(() => { try { return catalogType(route.params.type) } catch { return null } })
const edit = computed(() => route.params.id != null)
const title = computed(() => (edit.value ? '编辑' : '新增') + (type.value === 'materials' ? '票种物料' : '成本记录'))
const values = ref<CatalogValues>({}), original = ref<Record<string, unknown>>(), depts = ref<CatalogDepartment[]>([]), permissions = ref<string[]>([])
const loading = ref(false), ready = ref(false), uncertain = ref(false), saved = ref(false), scope = ref(false), error = ref(''), success = ref('')
let version = 0, disposed = false, controller: AbortController | undefined
const locked = computed(() => loading.value || !ready.value || uncertain.value || saved.value)
function pendingKey() { return `yc-catalog-pending:${session.value?.key}:${type.value}:${route.params.id || 'new'}` }
function invalidate() { version++; controller?.abort(); ready.value = false; values.value = {}; original.value = undefined; depts.value = []; permissions.value = []; error.value = ''; success.value = ''; uncertain.value = false; saved.value = false }
onUnmounted(() => { disposed = true; invalidate() })
async function load() {
  const current = ++version, key = session.value?.key, kind = type.value
  controller?.abort(); controller = new AbortController()
  const signal = controller.signal, active = () => !disposed && version === current && session.value?.key === key
  loading.value = true; ready.value = false; error.value = ''
  try {
    if (!key) throw Error('请先登录')
    if (!kind) throw Error('不支持的管理类型')
    const info = await request('/system/auth/get-permission-info', { signal })
    if (!active()) return
    if (!Array.isArray(info?.permissions)) throw Error('权限信息不完整')
    requireCatalogPermission(kind, info.permissions, edit.value)
    const departments = kind === 'costs' ? await request('/sport/boss/departments', { signal }) : []
    if (!active()) return
    if (!Array.isArray(departments)) throw Error('门店范围数据不完整')
    const row = edit.value ? await request(`/sport/boss/catalog/${kind}/get`, {data:{id:catalogId(route.params.id)},signal}) : undefined
    if (!active()) return
    // New materials need a server-provided all-data scope flag; query permission is required for this preflight.
    const probe = kind === 'materials' && !row ? await request('/sport/boss/catalog/materials/page', {data:{pageNo:1,pageSize:1},signal}) : row
    if (!active()) return
    if (row && catalogId(row.id) !== catalogId(route.params.id)) throw Error('服务器返回的记录编号不一致')
    const nextDepts = departments.map((d: any) => ({id:catalogId(d.id),name:String(d.name)}))
    const nextValues = catalogValues(kind,row)
    if (kind === 'materials' && probe?.writeScopeAllowed !== true) throw Error('票种物料需要全部数据管理范围')
    if (row && (typeof row.revision !== 'string' || !/^[a-f0-9]{64}$/.test(row.revision))) throw Error('记录版本缺失，请重新读取')
    permissions.value = info.permissions; depts.value = nextDepts; original.value = row; scope.value = probe?.writeScopeAllowed === true; values.value = nextValues
    ready.value = true; uncertain.value = sessionStorage.getItem(pendingKey()) === '1'; saved.value = false
  } catch (e) {
    if (active()) {
      error.value = (e as Error).message
    }
  } finally { if (active()) loading.value = false }
}
async function reread() {
  if (loading.value) return
  const current = version, key = session.value?.key
  try {
    await showConfirmDialog({title:'重新读取',message:uncertain.value&&!edit.value?'新增结果不明，不能在此重复新增。请先到记录列表核对是否已创建。':'重新读取会替换当前输入，请先保留需要核对的内容。',confirmButtonText:'确认读取'})
    if (disposed || current !== version || key !== session.value?.key) return
    if (uncertain.value && !edit.value) { error.value = '请先到记录列表核对新增结果；本页面保持锁定，避免重复新增。'; return }
    sessionStorage.removeItem(pendingKey()); await load()
  } catch { /* user cancelled */ }
}
async function submit() {
  if (locked.value || !type.value) return
  error.value = ''; success.value = ''
  let body: Record<string, unknown>
  try { body = catalogPayload(type.value,values.value,{permissions:permissions.value,departments:depts.value,writeScopeAllowed:scope.value,original:original.value}) }
  catch (e) { error.value = (e as Error).message; return }
  const current = version, key = session.value?.key, kind = type.value, editing = edit.value
  loading.value = true
  try {
    await showConfirmDialog({title:editing?'确认保存修改':'确认新增',message:kind==='materials'?'票种物料影响整个组织。请核对名称、价格及单包张数。':'请核对所属门店、成本金额和归属日期。',confirmButtonText:'确认保存'})
    if (disposed || current !== version || key !== session.value?.key) return
    sessionStorage.setItem(pendingKey(),'1'); uncertain.value = true
    const result = await request(`/sport/boss/catalog/${kind}/${editing?'update':'create'}`,{method:editing?'PUT':'POST',data:body})
    if (disposed || current !== version || key !== session.value?.key) return
    if (editing && result !== true) throw Error('保存响应不完整，请先核对服务器记录')
    if (!editing) catalogId(result)
    sessionStorage.removeItem(pendingKey()); uncertain.value = false; saved.value = true; success.value = '保存成功。请返回记录列表核对，或重新读取后继续编辑。'
  } catch (e) { if (e === 'cancel' || e === 'close') return; if (!disposed && current === version && key === session.value?.key) error.value = (e as Error).message + '；保存已锁定，请先核对服务器记录。' }
  finally { if (!disposed && current === version && key === session.value?.key) loading.value = false }
}
async function acknowledgeNew() {
  if (loading.value) return
  const current=version, key=session.value?.key
  try { await showConfirmDialog({title:'确认已核对新增结果',message:'请先在记录列表确认上一笔是否已创建。此操作不会撤销上次保存，仅允许开始一笔新的新增。已有记录请直接编辑，避免重复。',confirmButtonText:'已核对，开始新记录'}); if(disposed || current!==version || key!==session.value?.key) return; sessionStorage.removeItem(pendingKey()); await load() } catch { /* cancelled */ }
}
watch(() => [route.fullPath, session.value?.key], () => { invalidate(); loading.value = false; void load() }, {immediate:true})
</script>
<template>
  <div class="page-title"><p class="eyebrow">CATALOG / 基础管理</p><h1>{{title}}</h1><p class="intro">{{type==='materials'?'票种物料影响整个组织，需要全部数据管理范围。':'成本按门店归属，金额使用非负整元。'}}</p></div>
  <section v-if="error" class="card error" role="alert">{{error}}</section>
  <section v-if="success" class="card success" role="status">{{success}}</section>
  <section v-if="loading" class="card state"><van-loading />正在处理，请稍候</section>
  <van-notice-bar v-if="uncertain && !loading" wrapable text="保存结果尚未确认，请勿重复提交。编辑请重新读取；新增请先返回列表核对。" />
  <form v-if="ready&&type" @submit.prevent="submit"><section class="card filters">
    <label v-if="type==='costs'">所属门店<select v-model="values.deptId" :disabled="locked"><option value="">请选择启用门店</option><option v-for="d in depts" :key="d.id" :value="d.id">{{d.name}}</option></select></label>
    <label v-for="f in catalogFields(type)" :key="f.key">{{f.label}}<input v-model="values[f.key]" :type="f.key==='belongTime'?'date':'text'" :inputmode="['money','price'].includes(f.key)?'decimal':['num','cost'].includes(f.key)?'numeric':'text'" :maxlength="f.max" :disabled="locked" required></label>
  </section><van-button native-type="submit" type="primary" block :loading="loading" :disabled="locked">{{edit?'保存修改':'确认新增'}}</van-button></form>
  <section class="card"><van-button v-if="uncertain && !edit" :disabled="loading" @click="acknowledgeNew">已核对列表，开始新记录</van-button><van-button :disabled="loading" @click="reread">重新读取</van-button><router-link class="text-link" :to="{path:'/records',query:{type:type||''}}">返回记录列表 →</router-link></section>
</template>
