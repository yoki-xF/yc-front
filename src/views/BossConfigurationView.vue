<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

type Field = [key: string, label: string, type?: 'time' | 'datetime-local' | 'dept' | 'depts' | 'shift' | 'status' | 'number']
interface Config {key: string; label: string; permission: string; fields: Field[]}
const catalog: Config[] = [
  {key:'departments', label:'门店', permission:'system:dept', fields:[
    ['name','门店名称'],['parentId','上级部门编号（0 为顶级）'],['sort','排序','number'],['status','状态','status'],
    ['leaderUserId','负责人账号编号'],['phone','电话'],['email','邮箱'],['provinceId','省份编号'],['provinceName','省份'],
    ['cityId','城市编号'],['cityName','城市'],['areaId','区县编号'],['areaName','区县'],['address','地址'],['lng','经度'],['lat','纬度'],
  ]},
  {key:'shifts', label:'班次', permission:'sport:staff-schedule-config', fields:[
    ['deptId','门店','dept'],['name','班次名称'],['shiftType','班次类型','shift'],['workStartTime','上班时间','time'],
    ['workEndTime','下班时间','time'],['lateThreshold','迟到阈值（分钟）','number'],['earlyLeaveThreshold','早退阈值（分钟）','number'],
  ]},
  {key:'activities', label:'促销', permission:'sport:sales-activity', fields:[
    ['salesName','活动名称'],['salesCode','活动编码'],['startTime','开始时间（北京时间）','datetime-local'],
    ['endTime','结束时间（北京时间）','datetime-local'],['deptIds','参与门店','depts'],['salesMoney','活动金额'],['stat','状态','status'],
  ]},
  {key:'games', label:'玩法返佣', permission:'sport:game-sales-config', fields:[
    ['gameName','玩法名称'],['gameCode','玩法编码'],['rebate','返佣比例'],['stat','状态','status'],
  ]},
  {key:'targets', label:'月目标', permission:'sport:dept-sales-check', fields:[
    ['deptId','门店','dept'],['checkDate','月份（当月 1 日 00:00）','datetime-local'],['salesAmount','目标金额'],['stat','状态','status'],
  ]},
]
type Row = Record<string, unknown>
type Option = {id: string; name: string}
const base = '/sport/boss/admin'
const login = session.value?.key
const current = () => !!login && isCurrent(login)
const tabs = computed(() => catalog.filter(item => allowed(item.permission + ':query')))
const active = ref<Config>()
const rows = ref<Row[]>([]), detail = ref<Row>(), page = ref(1), total = ref(0), keyword = ref('')
const departments = ref<Option[]>([]), shifts = ref<{value: string; label: string}[]>([])
const fields = ref<Record<string,string>>(), participating = ref<string[]>([])
const busy = ref(false), error = ref(''), notice = ref('')
const can = (action: string) => !!active.value && allowed(active.value.permission + ':' + action)
const canRemove = computed(() => active.value?.key === 'shifts' ? can('delete')
  : active.value?.key === 'departments' ? can('delete') && can('update') : can('update'))

async function perform(operation: () => Promise<void>) {
  if (busy.value || !current()) return
  busy.value = true
  error.value = ''
  try { await operation() }
  catch (failure) {
    if (current() && failure !== 'cancel' && failure !== 'close') error.value = (failure as Error).message
  } finally { if (current()) busy.value = false }
}
async function readPage(next: number) {
  const config = active.value
  if (!config) return
  const response = await request<{list: Row[]; total: number}>(base + '/' + config.key + '/page', {
    data: {pageNo: next, pageSize: 20, keyword: keyword.value},
  })
  if (!current()) return
  rows.value = response.list
  page.value = next
  total.value = response.total
}
function select(config: Config) {
  return perform(async () => {
    active.value = config
    rows.value = []
    total.value = 0
    detail.value = undefined
    fields.value = undefined
    keyword.value = ''
    notice.value = ''
    await readPage(1)
  })
}
async function read(id: string) {
  const item = await request<Row>(base + '/' + active.value!.key + '/get', {data:{id}})
  if (current()) { detail.value = item; fields.value = undefined }
}
function display(row: Row, field: Field) {
  const value = row[field[0]]
  if (field[2] === 'status') return Number(value) === 0 ? '启用' : '停用'
  return value == null || value === '' ? '—' : String(value)
}
function edit(existing?: Row) {
  return perform(async () => {
    const config = active.value
    if (!config || !can(existing ? 'update' : 'create')) return
    if (config.fields.some(([, , type]) => type === 'dept' || type === 'depts' || type === 'shift')) {
      const options = await request<{departments: Option[]; shiftTypes?: {value:string;label:string}[]}>(base + '/options')
      if (!current()) return
      departments.value = options.departments.map(option => ({...option,id:identityId(option.id)}))
      shifts.value = options.shiftTypes ?? []
    }
    const defaults: Record<string,string> = {status:'0',stat:'0',parentId:'0',sort:'0',lateThreshold:'0',earlyLeaveThreshold:'0'}
    fields.value = Object.fromEntries(config.fields.map(([key]) => [key, String(existing?.[key] ?? defaults[key] ?? '')]))
    const raw = existing?.deptIds
    participating.value = Array.isArray(raw) ? raw.map(identityId) : raw ? String(raw).split(',').map(value => identityId(value.trim())) : []
    if (!existing) detail.value = undefined
    notice.value = ''
  })
}
function save() {
  return perform(async () => {
    const config = active.value, input = fields.value, existing = detail.value
    if (!config || !input || !can(existing ? 'update' : 'create')) return
    const values: Record<string, string | string[] | null> = {}
    for (const [key, label, type] of config.fields) {
      let value = input[key]?.trim() ?? ''
      if (type === 'depts') {
        if (!participating.value.length || participating.value.some(id => !departments.value.some(option => option.id === id))) throw Error('请核对有效参与门店')
        values[key] = [...participating.value]
        continue
      }
      if (!value && (config.key !== 'departments' || ['name','parentId','sort','status'].includes(key))) throw Error('请填写' + label)
      if (type === 'datetime-local') value = value.replace('T',' ')
      if ((type === 'time' || type === 'datetime-local') && /\d{2}:\d{2}$/.test(value) && value.length === (type === 'time' ? 5 : 16)) value += ':00'
      values[key] = value || null
    }
    await showConfirmDialog({title:'保存' + config.label + '配置', message: existing ? '保存后将重新读取配置。' : '确认新增这项配置？'})
    if (!current()) return
    const response = await request(base + '/' + config.key + '/save', {method:'POST',data:{id:existing?.id,revision:existing?.revision,values}})
    if (!current()) return
    const id = identityId(response)
    fields.value = undefined
    notice.value = '配置已保存'
    await read(id)
    await readPage(page.value)
  })
}
function remove() {
  return perform(async () => {
    const config = active.value, item = detail.value
    if (!config || !item || !canRemove.value) return
    const title = config.key === 'shifts' ? '删除班次' : '停用' + config.label
    await showConfirmDialog({title,message:config.key === 'shifts' ? '已有排班引用的班次无法删除。' : '停用后历史记录仍会保留。'})
    if (!current()) return
    const response = await request(base + '/' + config.key + '/remove',{method:'POST',data:{id:item.id,revision:item.revision}})
    if (!current()) return
    if (response !== true) throw Error('回执不完整，请重新读取配置')
    detail.value = undefined
    notice.value = title + '成功'
    await readPage(1)
  })
}
onMounted(async () => {
  await perform(async () => {if (!identity.value) await loadAccount()})
  const first = tabs.value[0]
  if (first) await select(first)
})
</script>

<template>
  <div class="page-title"><h1>经营配置</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !tabs.length" class="card">当前账号没有经营配置权限。</p>
  <section v-if="tabs.length" class="card">
    <div class="configuration-tabs" aria-label="配置类型">
      <van-button v-for="tab in tabs" :key="tab.key" size="small" :type="active?.key === tab.key ? 'primary' : 'default'" :disabled="busy" @click="select(tab)">{{ tab.label }}</van-button>
    </div>
    <form v-if="active" @submit.prevent="perform(() => readPage(1))">
      <van-field v-model="keyword" label="搜索" maxlength="100" :disabled="busy"/>
      <van-button native-type="submit" :disabled="busy">查询</van-button>
      <van-button v-if="can('create')" type="primary" :disabled="busy" @click="edit()">新增{{ active.label }}</van-button>
    </form>
    <van-empty v-if="active && !busy && !rows.length" description="暂无记录"/>
    <div v-for="row in rows" :key="String(row.id)" class="configuration-row">
      <strong>{{ row.name || row.salesName || row.gameName || row.deptName }}</strong>
      <span v-if="row.checkDate"> · {{ row.checkDate }}</span>
      <span v-if="row.status != null || row.stat != null"> · {{ Number(row.status ?? row.stat) === 0 ? '启用' : '停用' }}</span>
      <van-button size="small" :disabled="busy" @click="perform(() => read(identityId(row.id)))">查看</van-button>
    </div>
    <van-button size="small" :disabled="busy || page <= 1" @click="perform(() => readPage(page - 1))">上一页</van-button>
    <span> 第 {{ page }} 页 </span>
    <van-button size="small" :disabled="busy || page * 20 >= total" @click="perform(() => readPage(page + 1))">下一页</van-button>
  </section>
  <section v-if="active && detail && !fields" class="card">
    <h2>{{ active.label }}详情</h2>
    <dl v-for="field in active.fields" :key="field[0]"><div><dt>{{ field[1] }}</dt><dd>{{ display(detail, field) }}</dd></div></dl>
    <van-button v-if="can('update')" :disabled="busy" @click="edit(detail)">编辑配置</van-button>
    <van-button v-if="canRemove && Number(detail.status ?? detail.stat ?? 0) === 0" :disabled="busy" @click="remove">{{ active.key === 'shifts' ? '删除班次' : '停用' }}</van-button>
  </section>
  <form v-if="active && fields" class="card" @submit.prevent="save">
    <h2>{{ detail ? '编辑' : '新增' }}{{ active.label }}</h2>
    <template v-for="[key, label, type] in active.fields" :key="key">
      <fieldset v-if="type === 'depts'" :disabled="busy">
        <legend>{{ label }}</legend>
        <label v-for="department in departments" :key="department.id" class="config-field">
          <input v-model="participating" type="checkbox" :value="department.id"> {{ department.name }}
        </label>
      </fieldset>
      <label v-else-if="type === 'dept' || type === 'shift' || type === 'status'" class="config-field">{{ label }}
        <select v-model="fields[key]" :disabled="busy">
          <template v-if="type === 'status'"><option value="0">启用</option><option value="1">停用</option></template>
          <template v-else>
            <option value="">请选择</option>
            <template v-if="type === 'dept'"><option v-for="item in departments" :key="item.id" :value="item.id">{{ item.name }}</option></template>
            <template v-else><option v-for="item in shifts" :key="item.value" :value="String(item.value)">{{ item.label }}</option></template>
          </template>
        </select>
      </label>
      <label v-else-if="type === 'time' || type === 'datetime-local'" class="config-field">{{ label }}
        <input v-model="fields[key]" :type="type" step="1" :disabled="busy">
      </label>
      <van-field v-else v-model="fields[key]" :label="label" :type="type === 'number' ? 'digit' : 'text'" :disabled="busy"/>
    </template>
    <van-button type="primary" native-type="submit" :disabled="busy">保存配置</van-button>
    <van-button :disabled="busy" @click="fields = undefined">取消</van-button>
  </form>
</template>

<style scoped>
.configuration-tabs { display: flex; flex-wrap: wrap; gap: 8px; }
.configuration-row { border-bottom: 1px solid #dce4ef; padding: 12px 0; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.config-field { display: block; padding: 8px 0; }
.config-field select, .config-field input:not([type=checkbox]) { display: block; max-width: 100%; }
fieldset { margin: 12px 0; border: 1px solid #dce4ef; }
</style>
