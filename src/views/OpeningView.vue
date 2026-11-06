<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { ApiError, request } from '../api/client'
import { session } from '../api/session'
import { fundKeys, fundLabels, openingOptions, openingStatus, openingCommand, openingStorageKey, readOpeningCommand, totalFunds, totalStock, validateSelection, type Funds, type OpeningCommand, type OpeningOptions } from '../domain/store-opening'
const options = ref<OpeningOptions>({ departments: [], materials: [] }), dept = ref('')
const funds = ref<Funds>({ xj: '', wxBalance: '', hsk: '', zfb: '', szRmb: '' }), reason = ref('')
const lines = ref<{ materialId: string; revision: string; packageNum: string; sheetNum: string }[]>([])
const status = ref<ReturnType<typeof openingStatus> | null>(null), pending = ref<OpeningCommand | null>(null), review = ref<OpeningCommand | null>(null)
const loading = ref(false), ready = ref(false), blocked = ref(false), error = ref(''), success = ref('')
let disposed = false, generation = 0, controller: AbortController | undefined
const login = session.value?.key
const current = () => !disposed && !!login && session.value?.key === login
watch(() => session.value?.key, () => { if (!current()) { generation++; controller?.abort(); loading.value = false; ready.value = false; status.value = null; review.value = null; pending.value = null; funds.value = { xj: '', wxBalance: '', hsk: '', zfb: '', szRmb: '' }; reason.value = ''; lines.value = []; success.value = ''; options.value = { departments: [], materials: [] }; error.value = '登录已变化，请重新进入初始化页面' } })
onUnmounted(() => { disposed = true; generation++; controller?.abort() })
const locked = computed(() => loading.value || !ready.value || !status.value?.canInitialize || !!pending.value || blocked.value || !!success.value || !current())
const displayed = computed(() => pending.value || review.value)
function storageKey() {
  if (!current() || !identity.value) throw Error('请重新登录')
  return openingStorageKey(session.value!.tenantId, identity.value.user.id, dept.value)
}
async function initialize() {
  if (loading.value || !current()) return
  loading.value = true; error.value = ''; ready.value = false
  try {
    await loadAccount()
    if (!current()) return
    if (!allowed('sport:store-opening:create')) throw Error('当前账号没有门店初始化权限')
    const raw = await request('/sport/boss/opening/options')
    if (!current()) return
    options.value = openingOptions(raw); ready.value = true
    dept.value = options.value.departments[0]?.id || ''
  } catch (e) { if (current()) error.value = (e as Error).message }
  finally { if (current()) loading.value = false }
  if (current() && ready.value && dept.value) await load(true)
}
async function load(reset = false) {
  if (loading.value || !current() || !ready.value) return
  const seq = ++generation, selected = dept.value
  const valid = () => current() && generation === seq && dept.value === selected
  controller?.abort(); controller = new AbortController()
  loading.value = true; error.value = ''; status.value = null; review.value = null
  if (reset) { success.value = ''; funds.value = { xj: '', wxBalance: '', hsk: '', zfb: '', szRmb: '' }; reason.value = ''; lines.value = options.value.materials.map(m => ({ materialId: m.id, revision: m.revision, packageNum: '0', sheetNum: '0' })) }
  blocked.value = false; pending.value = null
  try {
    if (!options.value.departments.some(d => d.id === selected)) throw Error('请选择管理范围内的门店')
    // A corrupt or inaccessible journal must block fresh writes, never silently become an empty draft.
    try { pending.value = readOpeningCommand(sessionStorage.getItem(storageKey()), selected) } catch (e) { blocked.value = true; throw e }
    if (pending.value) { funds.value = { ...pending.value.funds }; reason.value = pending.value.reason; lines.value = pending.value.lines.map(l => ({ ...l })) }
    const raw = await request('/sport/boss/opening/status', { data: { deptId: selected }, signal: controller.signal })
    if (valid()) status.value = openingStatus(raw)
  } catch (e) { if (valid()) error.value = (e as Error).message }
  finally { if (valid()) loading.value = false }
}
function prepare() {
  error.value = ''; review.value = null
  if (locked.value) return
  try {
    const command = openingCommand(dept.value, reason.value, funds.value, lines.value, crypto.randomUUID())
    validateSelection(command, options.value); review.value = command
  } catch (e) { error.value = (e as Error).message }
}
async function submit(retry = false) {
  if (loading.value || !current() || blocked.value || !allowed('sport:store-opening:create') || !status.value) return
  const command = retry ? pending.value : review.value
  if (!command || (!retry && (pending.value || !status.value.canInitialize || success.value))) return
  const selected = dept.value, key = storageKey()
  loading.value = true; error.value = ''
  try {
    await showConfirmDialog({ title: retry ? '确认重试原初始化请求' : '确认初始资金及库存', message: `门店：${options.value.departments.find(d => d.id === selected)?.name}\n五类资金合计：${totalFunds(command.funds)} 元\n库存：${command.lines.length} 个票种，包数与散张数已逐项核对。\n${retry ? '原命令和请求编号保持不变，由服务器核对是否已完成。' : '此操作仅可执行一次，确认后不能覆盖初始化。'}`, confirmButtonText: retry ? '发送原请求' : '确认初始化' })
    if (!current() || dept.value !== selected) return
    if (!retry) {
      // Persist the exact immutable review before any POST. Failure to persist means no POST.
      sessionStorage.setItem(key, JSON.stringify(command))
      pending.value = command; review.value = null
    }
    const result = await request('/sport/boss/opening/apply', { method: 'POST', data: command as unknown as Record<string, unknown> })
    if (!current() || dept.value !== selected) return
    if (result?.status !== 'INITIALIZED' || result.deptId !== selected) throw Error('初始化响应不一致，请保留原请求并核对状态')
    // Lock before journal cleanup: a storage error must never unlock successful initialization.
    status.value = { initialized: true, canInitialize: false, reason: '门店已完成初始化' }; success.value = '初始化已确认，初始资金及库存已保存。后续调整请使用业务或更正流程。'
    sessionStorage.removeItem(key); pending.value = null
  } catch (e) {
    if (current() && e !== 'cancel' && e !== 'close') {
      error.value = (e as Error).message || '结果未确认，请保留原请求并核对'
      if (e instanceof ApiError && [400,403,10086].includes(e.code || 0)) {
        // A definite transactional rejection is not an unknown write outcome.
        sessionStorage.removeItem(key); pending.value = null; review.value = null
        ready.value = false; blocked.value = true; status.value = null
        error.value += '。本次请求已被明确拒绝，请重新读取权限与选项后逐项核对。'
      }
    }
  }
  finally { if (current()) loading.value = false }
}
onMounted(initialize)
</script>
<template>
  <div class="page-title"><p class="eyebrow">STORE OPENING / 首次启用</p><h1>设置门店初始账本</h1><p class="intro">仅用于首次营业前的资金与即开票库存基线。此处登记余额，不进行支付或转账。</p></div>
  <section v-if="ready" class="card filters"><label>管理门店<select v-model="dept" :disabled="loading || !current()" @change="load(true)"><option v-for="d in options.departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><van-button :loading="loading" :disabled="!dept || !current()" @click="load()">刷新初始化状态</van-button></section>
  <van-empty v-if="ready && !options.departments.length" description="暂无可管理的启用门店" />
  <section v-if="error" class="card error" role="alert">{{error}}<van-button v-if="!ready && current()" :loading="loading" @click="initialize">重新读取权限与选项</van-button></section>
  <section v-if="loading" class="card state"><van-loading />正在处理，请稍候</section>
  <section v-if="success" class="card success" role="status">{{success}}</section>
  <section v-if="status" class="card"><h2>{{status.initialized ? '已初始化 · 禁止覆盖' : status.canInitialize ? '可以首次初始化' : '暂不可初始化'}}</h2><p class="intro">{{status.reason || '请明确填写五类资金和每个票种的数量，包括零余额和零库存。'}}</p><p class="footnote">已有营业盘点、采购、资金单或调拨单、非零余额/库存、重复账户/库存时不能初始化；已有零库存票种也须纳入。</p></section>
  <van-notice-bar v-if="pending" wrapable text="有一笔待确认的初始化请求，输入已锁定。刷新不会清除它；重试只发送原命令。即使状态显示已初始化，也可用原请求核对返回结果。" />
  <section v-if="ready && dept && !pending && status?.canInitialize" class="card entry-fields"><h2>初始资金 · 元</h2><van-field label-width="100" v-for="k in fundKeys" :key="k" v-model="funds[k]" :label="fundLabels[k]" :disabled="locked" inputmode="decimal" placeholder="请明确填写，零余额填0" @update:model-value="review = null" /><h2>初始库存 · 全部已配置票种</h2><p class="intro">包数与散张分别登记，不自动换算。默认数量为零，请逐项修改并确认实际库存；包含零库存票种，价格或资料变化后需重新读取页面核对。</p><van-empty v-if="!lines.length" description="暂无票种，请先配置票种资料" /><div v-for="line in lines" :key="line.materialId" class="card"><h2>{{options.materials.find(m => m.id === line.materialId)?.materialName}}</h2><p class="intro">编号 {{line.materialId}} · {{options.materials.find(m => m.id === line.materialId)?.brandName}}<br>单包 {{options.materials.find(m => m.id === line.materialId)?.price}} 元 / 面值 {{options.materials.find(m => m.id === line.materialId)?.money}} 元 / 每包 {{options.materials.find(m => m.id === line.materialId)?.num}} 张</p><van-field label-width="100" v-model="line.packageNum" label="整包数" inputmode="numeric" placeholder="0至1000000" :disabled="locked" @update:model-value="review = null" /><van-field label-width="100" v-model="line.sheetNum" label="散张数" inputmode="numeric" placeholder="0至1000000" :disabled="locked" @update:model-value="review = null" /></div><van-field label-width="100" v-model="reason" label="启用说明" type="textarea" maxlength="500" show-word-limit placeholder="5至500字，说明初始资金及库存来源" :disabled="locked" @update:model-value="review = null" /><van-button block type="primary" :disabled="locked" @click="prepare">核对初始资金与库存</van-button></section>
  <section v-if="displayed" class="card confirm-panel"><h2>{{pending ? '待确认原请求' : '提交前逐项核对'}}</h2><p class="intro">门店：{{options.departments.find(d => d.id === displayed!.deptId)?.name}} · {{displayed.deptId}}</p><dl><div v-for="k in fundKeys" :key="k"><dt>{{fundLabels[k]}}</dt><dd>{{displayed.funds[k]}} 元</dd></div><div><dt>资金合计</dt><dd>{{totalFunds(displayed.funds)}} 元</dd></div><div><dt>初始库存金额</dt><dd>{{totalStock(displayed,options)}} 元</dd></div><div v-for="line in displayed.lines" :key="line.materialId"><dt>{{options.materials.find(m => m.id === line.materialId)?.materialName || '票种'}}（{{line.materialId}}）</dt><dd>{{line.packageNum}} 包 / {{line.sheetNum}} 散张</dd></div></dl><p class="result-caption">启用说明：{{displayed.reason}}<small>请求编号：{{displayed.requestKey}}</small></p><van-button v-if="!success" block type="primary" :loading="loading" :disabled="!status || blocked || !current()" @click="submit(!!pending)">{{pending ? '确认并重试原请求' : '确认核对并初始化'}}</van-button></section>
</template>
