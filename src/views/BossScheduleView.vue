<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount, type Department } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

interface Schedule {
  id: string; deptId: string; deptName: string; userId: string; userName: string
  configId: string; configName: string; scheduleDate: string; status: string; revision: string
  startClockTime?: string; endClockTime?: string
}
type Form = {id?: string; revision?: string; deptId: string; userId: string; configId: string; date: string; status: number}
const endpoint = '/sport/boss/schedules'
const login = session.value?.key
const current = () => !!login && isCurrent(login)
const today = new Intl.DateTimeFormat('sv-SE',{timeZone:'Asia/Shanghai'}).format(new Date())
const stores = ref<Department[]>([]), store = ref('')
const rows = ref<Schedule[]>([]), page = ref(1), total = ref(0)
const form = ref<Form>(), detail = ref<Schedule>()
const users = ref<Department[]>([]), configs = ref<Department[]>([])
const busy = ref(false), error = ref(''), notice = ref('')
async function perform(operation: () => Promise<void>) {
  if (!current() || busy.value) return
  busy.value = true
  error.value = ''
  try { await operation() }
  catch (failure) {
    if (current() && failure !== 'cancel' && failure !== 'close') error.value = (failure as Error).message
  } finally { if (current()) busy.value = false }
}
async function readPage(next: number) {
  const result = await request<{list:Schedule[];total:number}>(endpoint+'/page',{data:{deptId:store.value,pageNo:next,pageSize:20}})
  if (current()) { rows.value=result.list; total.value=result.total; page.value=next }
}
async function read(id: string) {
  const response = await request<Schedule>(endpoint+'/get',{data:{id}})
  if (current()) { detail.value=response; form.value=undefined }
}
async function options(deptId: string) {
  const response = await request<{users:Department[];configs:Department[]}>(endpoint+'/options',{data:{deptId}})
  if (current()) { users.value=response.users; configs.value=response.configs }
}
function edit(item?: Schedule) {
  return perform(async () => {
    const deptId=item?.deptId || store.value || stores.value[0]?.id
    if (!deptId) throw Error('暂无可安排排班的门店')
    await options(deptId)
    if (!current()) return
    form.value = item ? {id:item.id,revision:item.revision,deptId,userId:item.userId,configId:item.configId,date:item.scheduleDate.slice(0,10),status:Number(item.status)}
      : {deptId,userId:'',configId:'',date:today,status:1}
  })
}
function changeStore() {
  return perform(async () => {
    if (!form.value) return
    form.value.userId=''
    form.value.configId=''
    users.value=[]
    configs.value=[]
    await options(form.value.deptId)
  })
}
function save() {
  return perform(async () => {
    const command=form.value && {...form.value}
    if (!command || !command.userId || !command.configId || !command.date) throw Error('请选择员工、班次和日期')
    await showConfirmDialog({title:'保存排班',message:command.date})
    if (!current()) return
    const id = identityId(await request(endpoint + (command.id?'/update':'/create'),{method:command.id?'PUT':'POST',data:command}))
    if (!current()) return
    notice.value='排班已保存'
    form.value=undefined
    await read(id)
    await readPage(1)
  })
}
function cancelSchedule(item: Schedule) {
  return perform(async () => {
    await showConfirmDialog({title:'取消排班',message:item.scheduleDate.slice(0,10)+' · '+item.userName+' · '+item.configName})
    if (!current()) return
    const result = await request('/sport/boss/admin-schedule/cancel',{method:'POST',data:{id:item.id,revision:item.revision}})
    if (!current()) return
    if (result !== true) throw Error('取消回执不完整，请重新读取')
    detail.value=undefined
    notice.value='排班已取消'
    await readPage(1)
  })
}
const canEdit=(item:Schedule)=>!item.startClockTime&&!item.endClockTime&&item.scheduleDate.slice(0,10)>=today
onMounted(() => perform(async () => {
  if (!identity.value) await loadAccount()
  if (!current() || !allowed('sport:staff-schedule:query')) return
  stores.value=await request('/sport/boss/departments')
  await readPage(1)
}))
</script>

<template>
  <div class="page-title"><h1>员工排班</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !allowed('sport:staff-schedule:query')" class="card">当前账号没有排班查询权限。</p>
  <template v-if="allowed('sport:staff-schedule:query')">
    <section class="card">
      <label class="schedule-field">门店<select v-model="store" :disabled="busy" @change="perform(() => readPage(1))">
        <option value="">全部可见门店</option><option v-for="item in stores" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
      </select></label>
      <van-button v-if="allowed('sport:staff-schedule:create')" type="primary" :disabled="busy" @click="edit()">新增排班</van-button>
      <van-button :disabled="busy" @click="perform(() => readPage(page))">刷新排班</van-button>
      <van-empty v-if="!rows.length && !busy" description="暂无排班"/>
      <article v-for="row in rows" :key="row.id" class="schedule-row">
        <strong>{{ row.scheduleDate.slice(0,10) }} · {{ row.userName }}</strong>
        <p>{{ row.deptName }} · {{ row.configName }}</p>
        <van-button size="small" :disabled="busy" @click="perform(() => read(row.id))">查看排班</van-button>
      </article>
      <van-button size="small" :disabled="busy || page<=1" @click="perform(() => readPage(page-1))">上一页</van-button>
      <span> 第 {{ page }} 页 </span>
      <van-button size="small" :disabled="busy || page*20>=total" @click="perform(() => readPage(page+1))">下一页</van-button>
    </section>
    <section v-if="detail && !form" class="card">
      <h2>排班详情</h2>
      <p>{{ detail.scheduleDate.slice(0,10) }} · {{ detail.deptName }} · {{ detail.userName }} · {{ detail.configName }}</p>
      <p>打卡 {{ detail.startClockTime || '—' }} / {{ detail.endClockTime || '—' }}</p>
      <van-button v-if="canEdit(detail) && allowed('sport:staff-schedule:update')" :disabled="busy" @click="edit(detail)">编辑排班</van-button>
      <van-button v-if="canEdit(detail) && allowed('sport:staff-schedule:delete')" :disabled="busy" @click="cancelSchedule(detail)">取消排班</van-button>
    </section>
    <form v-if="form" class="card" @submit.prevent="save">
      <h2>{{ form.id ? '编辑排班' : '新增排班' }}</h2>
      <label class="schedule-field">门店<select v-model="form.deptId" :disabled="busy || !!form.id" @change="changeStore">
        <option v-for="item in stores" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
      </select></label>
      <label class="schedule-field">员工<select v-model="form.userId" :disabled="busy">
        <option value="">请选择</option><option v-for="item in users" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
      </select></label>
      <p v-if="!configs.length">该门店还没有班次，请先在经营配置中新增班次。</p>
      <label class="schedule-field">班次<select v-model="form.configId" :disabled="busy">
        <option value="">请选择</option><option v-for="item in configs" :key="item.id" :value="String(item.id)">{{ item.name }}</option>
      </select></label>
      <label class="schedule-field">状态<select v-model="form.status" :disabled="busy"><option :value="1">正常</option><option :value="2">请假</option><option :value="3">调休</option></select></label>
      <label class="schedule-field">排班日期<input v-model="form.date" type="date" :min="today" :disabled="busy"></label>
      <van-button native-type="submit" type="primary" :disabled="busy">保存排班</van-button>
      <van-button :disabled="busy" @click="form=undefined">关闭表单</van-button>
    </form>
  </template>
</template>

<style scoped>
.schedule-row { border-bottom: 1px solid #dce4ef; padding: 12px 0; }
.schedule-field { display: block; padding: 8px 0; }
.schedule-field select, .schedule-field input { display: block; max-width: 100%; }
</style>
