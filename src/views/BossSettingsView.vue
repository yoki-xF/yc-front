<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { ApiError, request } from '../api/client'
import { isCurrent, session } from '../api/session'

const labels = {
  sportsSalesEnabled: '启用竞彩销量录入',
  employeeProfitVisible: '员工可查看门店盈亏',
  morningFundsHidden: '隐藏早盘资金',
  personalSalesEnabled: '启用个人销量',
} as const
type Flags = Record<keyof typeof labels, boolean>
interface Settings {revision: string; values: Flags; canSave: boolean; locked: boolean; reason: string}
const fields = Object.entries(labels) as [keyof Flags, string][]
const endpoint = '/system/boss/business-settings'
const login = session.value?.key
const current = () => !!login && isCurrent(login)
const state = ref<Settings>(), values = ref<Flags>()
const reason = ref(''), busy = ref(false), uncertain = ref(false)
const error = ref(''), notice = ref('')
const dirty = computed(() => fields.some(([key]) => values.value?.[key] !== state.value?.values[key]))

function readback(data: Settings) {
  if (!data || !/^[a-f0-9]{64}$/.test(data.revision) || typeof data.canSave !== 'boolean' ||
      typeof data.locked !== 'boolean' || fields.some(([key]) => typeof data.values?.[key] !== 'boolean')) {
    throw Error('经营设置回执不完整，请重新读取')
  }
  state.value = data
  values.value = Object.fromEntries(fields.map(([key]) => [key, data.values[key]])) as Flags
  uncertain.value = false
}
async function perform(operation: () => Promise<void>) {
  if (busy.value || !current()) return
  busy.value = true
  error.value = ''
  notice.value = ''
  try { await operation() }
  catch (failure) {
    if (current() && failure !== 'cancel' && failure !== 'close') error.value = (failure as Error).message
  } finally { if (current()) busy.value = false }
}
function load() {
  return perform(async () => {
    if (!identity.value) await loadAccount()
    if (!current() || !allowed('system:service-config:query')) return
    const result = await request<Settings>(endpoint)
    if (current()) readback(result)
  })
}
function save() {
  return perform(async () => {
    if (!state.value?.canSave || !values.value || !dirty.value || uncertain.value) return
    const explanation = reason.value.trim()
    if (explanation.length < 5 || explanation.length > 1000) throw Error('请填写 5 至 1000 字的修改原因')
    const data = {revision: state.value.revision, values: {...values.value}, reason: explanation}
    const changes = fields.filter(([key]) => data.values[key] !== state.value?.values[key])
      .map(([key, label]) => label + ' · ' + (data.values[key] ? '开启' : '关闭'))
    await showConfirmDialog({title:'保存组织经营开关',message:changes.join('\n')})
    if (!current()) return
    uncertain.value = true
    try {
      const response = await request<Settings>(endpoint,{method:'PUT',data})
      if (!current()) return
      readback(response)
      reason.value = ''
      notice.value = '经营开关已保存'
    } catch (failure) {
      if (failure instanceof ApiError && [400,403,10086].includes(failure.code ?? 0)) uncertain.value = false
      throw failure
    }
  })
}
onMounted(load)
</script>

<template>
  <div class="page-title"><h1>组织经营开关</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="uncertain" class="card" role="status">保存结果待确认，请读取服务器设置。</p>
  <p v-if="!busy && !allowed('system:service-config:query')" class="card">当前账号没有经营设置权限。</p>
  <section v-if="allowed('system:service-config:query')" class="card">
    <p v-if="state">{{ state.reason }}</p>
    <form v-if="values && state" @submit.prevent="save">
      <fieldset :disabled="busy || !state.canSave || uncertain">
        <legend>组织经营规则</legend>
        <label v-for="[key,label] in fields" :key="key">
          <input v-model="values[key]" type="checkbox"> {{ label }}
        </label>
      </fieldset>
      <van-field v-if="state.canSave" v-model="reason" label="修改原因" type="textarea" maxlength="1000" :disabled="busy || uncertain"/>
      <van-button v-if="state.canSave" type="primary" native-type="submit" :disabled="busy || uncertain || !dirty">保存经营开关</van-button>
    </form>
    <van-button plain :disabled="busy" @click="load">读取服务器设置</van-button>
  </section>
</template>

<style scoped>
fieldset { margin: 12px 0; border: 1px solid #dce4ef; }
fieldset label { display: block; padding: 8px 0; }
</style>
