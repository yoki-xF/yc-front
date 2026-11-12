<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount, type Department } from '../api/account'
import { ApiError, request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'
import { dayUuid } from '../domain/cash-ledger'

interface Context {
  day: {id: string; businessDate: string; status: string}; revision: string
  users: Department[]; games: (Department & {rebate: string})[]
}
interface Command {
  deptId:string; dayId:string; revision:string; userId:string; gameSalesId:string
  salesAmount:string; rebate:string; commission:string; reason:string; requestKey:string
}
const endpoint='/sport/boss/commission'
const login=session.value?.key
const current=()=>!!login&&isCurrent(login)
const stores=ref<Department[]>([]), dept=ref(''), context=ref<Context>()
const user=ref(''), game=ref(''), sales=ref(''), rebate=ref(''), commission=ref(''), reason=ref('')
const pending=ref<Command>(), record=ref(''), busy=ref(false), error=ref(''), notice=ref('')
const key=()=>['yc-commission-v1',session.value?.tenantId,identity.value?.user.id,dept.value].join(':')
const amount=/^(0|[1-9]\d{0,9})(\.\d{1,2})?$/
const rate=/^(0|[1-9]\d{0,2})(\.\d{1,4})?$/
function validate(command:Command) {
  for (const id of [command.deptId,command.userId,command.gameSalesId]) identityId(id)
  if (!dayUuid(command.dayId)||!dayUuid(command.requestKey)||!/^[a-f0-9]{64}$/.test(command.revision)) throw Error('原请求营业日或版本无效')
  if (!amount.test(command.salesAmount)||!amount.test(command.commission)) throw Error('请输入有效的销量与佣金，最多两位小数')
  if (!rate.test(command.rebate)||Number(command.rebate)>100) throw Error('返点须为 0 至 100，最多四位小数')
  if (command.reason.length<5||command.reason.length>500) throw Error('请填写 5 至 500 字的记录说明')
}
async function perform(operation:()=>Promise<void>) {
  if (!current()||busy.value) return
  busy.value=true
  error.value=''
  try { await operation() }
  catch (failure) {
    if (current()&&failure!=='cancel'&&failure!=='close') error.value=(failure as Error).message
  } finally { if (current()) busy.value=false }
}
async function readContext() {
  if (!dept.value) return
  const response=await request<Context>(endpoint+'/options',{data:{deptId:dept.value}})
  if (!current()) return
  context.value=response
}
function chooseStore() {
  return perform(async()=>{
    context.value=undefined
    pending.value=undefined
    user.value=game.value=sales.value=rebate.value=commission.value=reason.value=record.value=notice.value=''
    const saved=localStorage.getItem(key())
    if (saved!==null) {
      const command=JSON.parse(saved) as Command
      validate(command)
      if (command.deptId!==dept.value) throw Error('原请求门店不符，请保留日志核对')
      pending.value=command
      return
    }
    await readContext()
  })
}
watch(game,value=>{
  const configured=String(context.value?.games.find(item=>String(item.id)===value)?.rebate??'')
  rebate.value=configured.includes('.')?configured.replace(/0+$/,'').replace(/\.$/,''):configured
})
function submit() {
  return perform(async()=>{
    const original=pending.value
    const state=context.value
    if (!original&&!state) return
    const command=original??{deptId:dept.value,dayId:state!.day.id,revision:state!.revision,
      userId:user.value,gameSalesId:game.value,salesAmount:sales.value.trim(),rebate:rebate.value.trim(),
      commission:commission.value.trim(),reason:reason.value.trim(),requestKey:crypto.randomUUID()}
    validate(command)
    const storageKey=key(), encoded=JSON.stringify(command)
    await showConfirmDialog({title:original?'核对并重试原请求':'确认新增返佣盘点',message:original
      ? '使用原请求编号核对，服务器会返回原结果。'
      : state!.day.businessDate+' · 佣金 '+command.commission+' 元'})
    if (!current()) return
    const saved=localStorage.getItem(storageKey)
    if (original ? saved!==encoded : saved!==null) throw Error('已有待核对的原请求，请重新选择门店读取')
    localStorage.setItem(storageKey,encoded)
    pending.value=command
    let result
    try {
      result=await request<{status:string;recordId:string;businessDate:string;notice:string}>(endpoint+'/create',{method:'POST',data:{...command}})
    } catch (failure) {
      if (!original&&current()&&failure instanceof ApiError&&[400,403,10086].includes(failure.code??0)&&localStorage.getItem(storageKey)===encoded) {
        localStorage.removeItem(storageKey)
        pending.value=undefined
      }
      throw failure
    }
    if (!current()) return
    if (result?.status!=='CREATED'||!result.recordId||!result.businessDate) throw Error('保存回执不完整，请保留原请求')
    record.value=identityId(result.recordId)
    if (localStorage.getItem(storageKey)!==encoded) throw Error('原请求日志已变化，请核对')
    localStorage.removeItem(storageKey)
    pending.value=undefined
    context.value=undefined
    sales.value=commission.value=reason.value=''
    notice.value=result.businessDate+' · '+result.notice
  })
}
onMounted(async()=>{
  await perform(async()=>{
    if (!identity.value) await loadAccount()
    if (!current()||!allowed('sport:check-game-sales:create')) return
    stores.value=await request('/sport/boss/departments')
    dept.value=String(stores.value[0]?.id??'')
  })
  if (dept.value) await chooseStore()
})
</script>

<template>
  <div class="page-title"><h1>新增返佣盘点</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !allowed('sport:check-game-sales:create')" class="card">当前账号没有新增返佣盘点权限。</p>
  <section v-if="allowed('sport:check-game-sales:create')" class="card">
    <label class="commission-field">门店<select v-model="dept" :disabled="busy" @change="chooseStore">
      <option v-for="store in stores" :key="store.id" :value="String(store.id)">{{ store.name }}</option>
    </select></label>
    <router-link v-if="record && allowed('sport:check-game-sales:query')" :to="'/records/commission/'+record">查看已保存记录</router-link>
    <div v-if="pending">
      <p>原请求待核对。销量 {{ pending.salesAmount }} 元，返点 {{ pending.rebate }}，佣金 {{ pending.commission }} 元。</p>
      <van-button type="primary" :disabled="busy" @click="submit">核对并重试原请求</van-button>
    </div>
    <form v-else-if="context" @submit.prevent="submit">
      <p>营业日 {{ context.day.businessDate }}</p>
      <label class="commission-field">盘点员工<select v-model="user" :disabled="busy">
        <option value="">请选择</option><option v-for="item in context.users" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
      </select></label>
      <label class="commission-field">玩法<select v-model="game" :disabled="busy">
        <option value="">请选择</option><option v-for="item in context.games" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
      </select></label>
      <van-field v-model="sales" label="销售金额" inputmode="decimal" :disabled="busy"/>
      <van-field v-model="rebate" label="返点（%）" inputmode="decimal" :disabled="busy"/>
      <van-field v-model="commission" label="佣金" inputmode="decimal" :disabled="busy"/>
      <van-field v-model="reason" label="记录说明" type="textarea" maxlength="500" :disabled="busy"/>
      <van-button native-type="submit" type="primary" :disabled="busy">保存返佣盘点</van-button>
    </form>
    <van-button v-if="!context && !pending && dept" :disabled="busy" @click="chooseStore">读取营业日与选项</van-button>
  </section>
</template>

<style scoped>
.commission-field { display: block; padding: 8px 0; }
.commission-field select { display: block; max-width: 100%; }
</style>
