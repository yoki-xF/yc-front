<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount, type Department } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

interface Employee { id: string; username: string; nickname: string; deptName?: string; status: string | number }
interface EmployeeDetail extends Employee {
  revision: string; writeScopeAllowed: boolean; deptId: string | null; deptIds: string[]
  mobile: string | null; email: string | null; remark: string | null
}
interface Actions {
  id: string; revision: string; status: number; canStatus: boolean; canReset: boolean; canAssign: boolean
  roleIds: string[]; roles: { id: string; name: string; disabled: boolean }[]
}
const directory = '/system/boss/directory/users'
const actionPath = '/system/boss/user-actions'
const login = session.value?.key
const current = () => !!login && isCurrent(login)
const employees = ref<Employee[]>([])
const departments = ref<Department[]>([])
const detail = ref<EmployeeDetail>()
const actions = ref<Actions>()
const page = ref(1), total = ref(0), search = ref(''), applied = ref('')
const busy = ref(false), error = ref(''), notice = ref('')
const password = ref('')
const selectedRoles = ref<string[]>([])
const form = ref<{
  username: string; nickname: string; deptId: string; deptIds: string[]
  mobile: string; email: string; remark: string; password: string; id?: string; revision?: string
}>()
function clearSelection() {
  detail.value = undefined
  actions.value = undefined
  form.value = undefined
  password.value = ''
  selectedRoles.value = []
}
async function perform(operation: () => Promise<void>) {
  if (!current() || busy.value) return
  busy.value = true
  error.value = ''
  try { await operation() }
  catch (failure) {
    if (current() && failure !== 'cancel' && failure !== 'close') error.value = (failure as Error).message
  } finally { if (current()) busy.value = false }
}
async function readPage(next: number, query = applied.value) {
  const response = await request<{list: Employee[]; total: number}>(directory + '/page', { data: {pageNo: next, pageSize: 20, username: query} })
  if (!current()) return
  employees.value = response.list
  total.value = response.total
  page.value = next
  applied.value = query
}
async function readEmployee(id: string) {
  clearSelection()
  const data = await request<EmployeeDetail>(directory + '/get', {data: {id}})
  if (!current()) return
  detail.value = data
  if (id === identity.value?.user.id || !data.writeScopeAllowed ||
      !['system:user:update','system:user:update-password','system:permission:assign-user-role'].some(allowed)) return
  const result = await request<Actions>(actionPath + '/get', {data: {id}})
  if (!current()) return
  actions.value = result
  selectedRoles.value = [...result.roleIds]
}
function open(id: string) { notice.value = ''; return perform(() => readEmployee(identityId(id))) }
function list(next: number) { return perform(() => readPage(next)) }
function download() {
  return perform(async () => {
    if (!allowed('system:user:export')) return
    const csv = await request<string>('/system/admin-native/exports/users', {data:{search:applied.value}})
    if (!current()) return
    if (typeof csv !== 'string') throw Error('导出回执不完整')
    const url = URL.createObjectURL(new Blob(['\ufeff', csv], {type:'text/csv;charset=utf-8'}))
    const link = document.createElement('a')
    link.href = url
    link.download = '员工账号.csv'
    link.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  })
}
function edit(existing?: EmployeeDetail) {
  return perform(async () => {
    if (existing ? !existing.writeScopeAllowed || !allowed('system:user:update') : !allowed('system:user:create')) return
    const options = await request<Department[]>('/sport/boss/departments')
    if (!current()) return
    departments.value = options.map(option => ({id: identityId(option.id), name: option.name}))
    form.value = {
      id: existing?.id, revision: existing?.revision, username: existing?.username ?? '',
      nickname: existing?.nickname ?? '', deptId: existing?.deptId ?? '', deptIds: [...(existing?.deptIds ?? [])],
      mobile: existing?.mobile ?? '', email: existing?.email ?? '', remark: existing?.remark ?? '', password: '',
    }
  })
}
function save() {
  return perform(async () => {
    if (!form.value) return
    const {password: initialPassword, ...fields} = form.value
    if (!fields.username.trim() || !fields.nickname.trim() || !fields.deptIds.includes(fields.deptId)) {
      throw Error('请填写账号和姓名，并将主部门纳入授权门店')
    }
    if (!fields.id && (initialPassword.length < 4 || initialPassword.length > 16)) throw Error('初始密码须为 4 至 16 位')
    await showConfirmDialog({title: fields.id ? '确认保存员工资料' : '确认开通员工账号',message: fields.username})
    if (!current()) return
    const result = await request(directory + (fields.id ? '/update' : '/create'), {
      method: fields.id ? 'PUT' : 'POST', data: fields.id ? fields : {...fields, password: initialPassword},
    })
    if (fields.id && result !== true) throw Error('回执不完整，请重新读取账号后核对')
    const id = fields.id ?? identityId(result)
    if (!current()) return
    notice.value = fields.id ? '员工资料已保存' : '员工账号已开通，可继续分配角色'
    await readPage(page.value)
    if (allowed('system:user:query')) await readEmployee(id)
    else clearSelection()
  })
}
function change(action: 'status' | 'password' | 'roles') {
  return perform(async () => {
    const target = actions.value
    if (!target || (action === 'status' ? !target.canStatus : action === 'password' ? !target.canReset : !target.canAssign)) return
    if (action === 'password' && (password.value.length < 4 || password.value.length > 16)) throw Error('新密码须为 4 至 16 位')
    const data = action === 'status' ? {status: target.status === 0 ? 1 : 0}
      : action === 'password' ? {password: password.value} : {roleIds: [...selectedRoles.value]}
    const title = action === 'status' ? (target.status === 0 ? '停用账号' : '启用账号')
      : action === 'password' ? '重置密码' : '保存角色'
    await showConfirmDialog({title, message: '账号 ' + detail.value?.username})
    if (!current()) return
    const result = await request(actionPath + '/' + action, {method: 'PUT', data: {...data, id: target.id, revision: target.revision}})
    if (!current()) return
    if (result !== true) throw Error('回执不完整，请重新读取账号后核对')
    notice.value = title + '成功'
    await readEmployee(target.id)
    await readPage(page.value)
  })
}
onMounted(() => perform(async () => {
  if (!identity.value) await loadAccount()
  if (current() && allowed('system:user:list')) await readPage(1)
}))
</script>

<template>
  <div class="page-title"><h1>员工账号管理</h1></div>
  <router-link v-if="allowed('system:user:import') && allowed('system:user:create')" class="text-link" to="/admin/user-import">批量导入员工</router-link>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !allowed('system:user:list')" class="card">当前账号没有员工列表权限。</p>
  <template v-if="allowed('system:user:list')">
    <section class="card">
      <form @submit.prevent="perform(() => readPage(1, search.trim()))">
        <van-field v-model="search" label="账号" maxlength="100" :disabled="busy"/>
        <van-button native-type="submit" :disabled="busy">查询员工</van-button>
      </form>
      <van-button v-if="allowed('system:user:export')" :disabled="busy" @click="download">导出查询结果</van-button>
      <van-button v-if="allowed('system:user:create')" type="primary" :disabled="busy" @click="edit()">开通员工账号</van-button>
      <van-button :disabled="busy" @click="list(page)">刷新员工列表</van-button>
      <van-empty v-if="!busy && !employees.length" description="暂无员工账号" />
      <div v-for="employee in employees" :key="employee.id" class="employee-row">
        <div><strong>{{ employee.nickname }}</strong> · {{ employee.username }}</div>
        <div>{{ employee.deptName }} · {{ Number(employee.status) === 0 ? '启用' : '停用' }}</div>
        <van-button v-if="allowed('system:user:query')" size="small" :disabled="busy" @click="open(employee.id)">查看账号</van-button>
      </div>
      <van-button size="small" :disabled="busy || page <= 1" @click="list(page - 1)">上一页</van-button>
      <span> 第 {{ page }} 页 </span>
      <van-button size="small" :disabled="busy || page * 20 >= total" @click="list(page + 1)">下一页</van-button>
    </section>
    <section v-if="detail && !form" class="card">
      <h2>{{ detail.nickname }} · {{ detail.username }}</h2>
      <p>{{ detail.deptName }} · {{ Number(detail.status) === 0 ? '启用' : '停用' }}</p>
      <van-button :disabled="busy" @click="open(detail.id)">重新读取账号</van-button>
      <van-button v-if="detail.writeScopeAllowed && allowed('system:user:update')" :disabled="busy" @click="edit(detail)">修改资料与门店</van-button>
      <van-button v-if="actions?.canStatus" :disabled="busy" @click="change('status')">{{ actions.status === 0 ? '停用账号' : '启用账号' }}</van-button>
      <form v-if="actions?.canReset" @submit.prevent="change('password')">
        <van-field v-model="password" type="password" label="新密码" autocomplete="new-password" maxlength="16" :disabled="busy" />
        <van-button native-type="submit" :disabled="busy || !password">重置密码</van-button>
      </form>
      <fieldset v-if="actions?.canAssign" :disabled="busy">
        <legend>账号角色</legend>
        <label v-for="role in actions.roles" :key="role.id" class="choice">
          <input v-model="selectedRoles" type="checkbox" :value="role.id" :disabled="role.disabled"> {{ role.name }}
        </label>
        <van-button :disabled="busy" @click="change('roles')">保存角色</van-button>
      </fieldset>
    </section>
    <form v-if="form" class="card" @submit.prevent="save">
      <h2>{{ form.id ? '修改资料与门店' : '开通员工账号' }}</h2>
      <van-field v-model="form.username" label="账号" maxlength="30" :disabled="busy || !!form.id" />
      <van-field v-model="form.nickname" label="姓名" maxlength="30" :disabled="busy" />
      <van-field v-if="!form.id" v-model="form.password" label="初始密码" type="password" autocomplete="new-password" maxlength="16" :disabled="busy" />
      <van-field v-model="form.mobile" label="手机号" maxlength="11" :disabled="busy" />
      <van-field v-model="form.email" label="邮箱" maxlength="50" :disabled="busy" />
      <van-field v-model="form.remark" label="备注" maxlength="500" :disabled="busy" />
      <label class="choice">主部门
        <select v-model="form.deptId" :disabled="busy">
          <option value="">请选择</option>
          <option v-for="department in departments" :key="department.id" :value="department.id">{{ department.name }}</option>
        </select>
      </label>
      <fieldset :disabled="busy">
        <legend>授权门店</legend>
        <label v-for="department in departments" :key="department.id" class="choice">
          <input v-model="form.deptIds" type="checkbox" :value="department.id"> {{ department.name }}
        </label>
      </fieldset>
      <van-button type="primary" native-type="submit" :disabled="busy">保存</van-button>
      <van-button :disabled="busy" @click="form = undefined">取消</van-button>
    </form>
  </template>
</template>

<style scoped>
.employee-row { border-bottom: 1px solid #dce4ef; padding: 12px 0; }
.choice { display: block; padding: 8px 0; }
fieldset { margin: 12px 0; border: 1px solid #dce4ef; }
</style>
