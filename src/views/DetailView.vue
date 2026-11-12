<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { showConfirmDialog } from 'vant'
import { isCurrent, session } from '../api/session'
import { request } from '../api/client'
import { getResource, recordView, can } from '../domain/resources.js'
import PageState from '../components/PageState.vue'
const editable = ref(false), correctable = ref(false), deleteRevision = ref('')
const deleting = ref(false), deleteError = ref(''), deleteUncertain = ref(false)
const router = useRouter(), login = session.value?.key
const current = () => !disposed && !!login && isCurrent(login)
const route = useRoute(), loading = ref(true), error = ref(''), record = ref<any>(null)
let disposed = false, controller: AbortController | undefined
onUnmounted(() => { disposed = true; controller?.abort() })
async function load() {
  loading.value = true; error.value = ''; record.value = null; deleteRevision.value = ''; deleteUncertain.value = false
  controller?.abort(); controller = new AbortController()
  try {
    const type = String(route.params.type), id = String(route.params.id), resource = getResource(type)
    if (!/^[1-9]\d*$/.test(id)) throw Error('记录编号无效')
    const info = await request('/system/auth/get-permission-info', { signal: controller.signal })
    if (!can(info.permissions, resource.detailPermission || resource.permission)) throw Error('当前账号没有记录详情权限')
    editable.value = ['materials','costs'].includes(type) && can(info.permissions, type === 'materials' ? 'sport:material-ggl:update' : 'sport:cost-record:update')
    const raw = await request((resource.queryBase || resource.base) + '/get', { data: { id }, signal: controller.signal })
    if (!raw || String(raw.id) !== id) throw Error('记录不存在或无权访问')
    if (['materials','costs'].includes(type) && can(info.permissions, resource.permission.replace(/:query$/,':delete')) &&
        typeof raw.revision === 'string' && /^[a-f0-9]{64}$/.test(raw.revision)) deleteRevision.value = raw.revision
    correctable.value = ['inventory','funds','business','commission'].includes(type) && raw.correctionSupported === true && can(info.permissions, resource.permission.replace(/:query$/,':update'))
    if (!disposed) record.value = { ...recordView(type, raw), lines: raw.lines, loginAccount: type === 'users' ? `yc-${id}` : '' }
  } catch (e) { if (!disposed) error.value = (e as Error).message }
  finally { if (!disposed) loading.value = false }
}
async function remove() {
  if (!deleteRevision.value || !record.value || deleting.value || deleteUncertain.value || !current()) return
  const type = String(route.params.type), id = String(route.params.id), revision = deleteRevision.value
  deleting.value = true
  deleteError.value = ''
  try {
    await showConfirmDialog({title:'确认删除此记录',message:record.value.title})
    if (!current() || String(route.params.type) !== type || String(route.params.id) !== id) return
    deleteUncertain.value = true
    const result = await request('/sport/boss/catalog/'+type+'/delete',{method:'POST',data:{id,revision}})
    if (!current()) return
    if (result !== true) throw Error('删除回执不完整，请返回列表核对')
    await router.replace({path:'/records',query:{type}})
  } catch (failure) {
    if (current() && failure !== 'cancel' && failure !== 'close') deleteError.value = (failure as Error).message
  } finally { if (current()) deleting.value = false }
}
onMounted(load)
</script>
<template><router-link :to="'/records?type=' + route.params.type" class="text-link">← 返回经营记录</router-link><div class="page-title"><h1>记录详情</h1><p class="intro">仅展示当前账号可读取的数据。</p></div><PageState :loading="loading" :error="error" @retry="load"><router-link v-if="record && editable" :to="'/catalog/' + route.params.type + '/' + route.params.id + '/edit'" class="module-card quick-link"><strong>编辑此记录</strong><span>读取最新版本后核对修改 ↗</span></router-link><router-link v-if="record && correctable" :to="'/corrections/' + route.params.type + '/' + route.params.id" class="module-card quick-link"><strong>申请留痕更正</strong><span>填写原因、预览库存资金及报表影响 ↗</span></router-link><section v-if="record" class="card"><h2>{{ record.title }}</h2><dl><div v-if="record.loginAccount"><dt>专属登录号</dt><dd>{{ record.loginAccount }}</dd></div><div v-for="field in record.fields" :key="field.key"><dt>{{ field.label }}</dt><dd>{{ field.value }}</dd></div></dl><van-button v-if="deleteRevision" type="danger" plain :disabled="deleting || deleteUncertain" @click="remove">删除此记录</van-button><p v-if="deleteError" class="error" role="alert">{{ deleteError }}</p><van-button v-if="deleteUncertain && deleteError" plain :disabled="deleting" @click="load">重新读取记录</van-button></section><section v-for="(line, index) in record?.lines || []" :key="index" class="card"><h2>{{ line.materialName || '票种明细' }}</h2><dl><div><dt>面值 / 单包价格</dt><dd>{{ line.money ?? '—' }} / {{ line.price ?? '—' }}</dd></div><div><dt>包数 / 张数</dt><dd>{{ line.invPackageNum ?? '—' }} / {{ line.invZhangNum ?? '—' }}</dd></div></dl></section></PageState></template>
