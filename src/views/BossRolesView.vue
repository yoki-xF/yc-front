<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

interface Role { id: string; name: string; code: string; status: string; type: string }
interface RoleDetail extends Role { revision: string; sort: string; remark?: string; writeScopeAllowed: boolean }
interface Option { id: string; name: string }
interface Grants {
  revision: string; menuIds: string[]; deptIds: string[]; dataScope: number
  menus: (Option & { parentId: string })[]; departments: Option[]
  canMenus: boolean; canScope: boolean; menuWarning: string; scopeWarning: string
}
const directory = '/system/boss/directory/roles'
const access = '/system/boss/role-actions'
const login = session.value?.key
const current = () => !!login && isCurrent(login)
const roles = ref<Role[]>([]), detail = ref<RoleDetail>(), grants = ref<Grants>()
const menuIds = ref<string[]>([]), deptIds = ref<string[]>([]), dataScope = ref(5)
const page = ref(1), total = ref(0), name = ref('')
const busy = ref(false), error = ref(''), notice = ref('')
const form = ref<{id?: string; revision?: string; name: string; code: string; sort: number; status: number; remark: string}>()
const scopes = [
  {value: 5, label: '仅本人'}, {value: 4, label: '本人部门及下级'}, {value: 3, label: '本人部门'},
  {value: 2, label: '指定门店'}, {value: 1, label: '本组织全部'},
]

async function perform(operation: () => Promise<void>) {
  if (busy.value || !current()) return
  busy.value = true
  error.value = ''
  try { await operation() }
  catch (failure) {
    if (current() && failure !== 'cancel' && failure !== 'close') error.value = (failure as Error).message
  } finally { if (current()) busy.value = false }
}
async function readList(next: number) {
  const response = await request<{list: Role[]; total: number}>(directory + '/page', {data: {name: name.value, pageNo: next, pageSize: 20}})
  if (!current()) return
  roles.value = response.list
  total.value = response.total
  page.value = next
}
async function readRole(id: string) {
  detail.value = undefined
  grants.value = undefined
  form.value = undefined
  const role = await request<RoleDetail>(directory + '/get', {data: {id}})
  if (!current()) return
  detail.value = role
  if (!role.writeScopeAllowed ||
      !['system:permission:assign-role-menu', 'system:permission:assign-role-data-scope'].some(allowed)) return
  const response = await request<Grants>(access + '/get', {data: {id}})
  if (!current()) return
  grants.value = response
  menuIds.value = [...response.menuIds]
  deptIds.value = [...response.deptIds]
  dataScope.value = response.dataScope
}
function edit(role?: RoleDetail) {
  notice.value = ''
  form.value = role ? {
    id: role.id, revision: role.revision, name: role.name, code: role.code,
    sort: Number(role.sort), status: Number(role.status), remark: role.remark ?? '',
  } : {name: '', code: '', sort: 0, status: 0, remark: ''}
}
function save() {
  return perform(async () => {
    if (!form.value) return
    const fields = {...form.value, name: form.value.name.trim(), code: form.value.code.trim(), sort: Number(form.value.sort)}
    if (!fields.name || !fields.code || !Number.isInteger(fields.sort) || fields.sort < 0 || fields.sort > 999999999) {
      throw Error('请填写角色名称、编码及有效排序')
    }
    await showConfirmDialog({title: fields.id ? '保存角色资料' : '新增角色', message: fields.name})
    if (!current()) return
    const response = await request(directory + (fields.id ? '/update' : '/create'), {method: fields.id ? 'PUT' : 'POST', data: fields})
    if (!current()) return
    if (fields.id && response !== true) throw Error('保存回执不完整，请重新读取')
    notice.value = '角色已保存'
    await readRole(fields.id ?? identityId(response))
    await readList(page.value)
  })
}
function saveGrants(kind: 'menus' | 'scope') {
  return perform(async () => {
    const role = detail.value, options = grants.value
    if (!role || !options || (kind === 'menus' ? !options.canMenus : !options.canScope)) return
    if (kind === 'scope' && dataScope.value === 2 && !deptIds.value.length) throw Error('请至少选择一个门店')
    const data = kind === 'menus' ? {menuIds: [...menuIds.value]} : {dataScope: dataScope.value, deptIds: dataScope.value === 2 ? [...deptIds.value] : []}
    const title = kind === 'menus' ? '保存功能权限' : '保存数据范围'
    await showConfirmDialog({title, message: role.name})
    if (!current()) return
    const result = await request(access + '/' + kind, {method: 'PUT', data: {...data, id: role.id, revision: options.revision}})
    if (!current()) return
    if (result !== true) throw Error('授权回执不完整，请重新读取角色核对')
    notice.value = title + '成功'
    await readRole(role.id)
  })
}
function menuName(menu: Grants['menus'][number]) {
  const parent = grants.value?.menus.find(option => option.id === menu.parentId)
  return parent ? parent.name + ' / ' + menu.name : menu.name
}
onMounted(() => perform(async () => {
  if (!identity.value) await loadAccount()
  if (current() && allowed('system:role:query')) await readList(1)
}))
</script>

<template>
  <div class="page-title"><h1>组织角色管理</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !allowed('system:role:query')" class="card">当前账号没有角色查询权限。</p>
  <template v-if="allowed('system:role:query')">
    <section class="card">
      <form @submit.prevent="perform(() => readList(1))">
        <van-field v-model="name" label="角色名称" maxlength="100" :disabled="busy"/>
        <van-button native-type="submit" :disabled="busy">查询角色</van-button>
        <van-button v-if="allowed('system:role:create')" type="primary" :disabled="busy" @click="edit()">新增角色</van-button>
      </form>
      <van-empty v-if="!busy && !roles.length" description="暂无角色"/>
      <div v-for="role in roles" :key="role.id" class="role-row">
        <strong>{{ role.name }}</strong> · {{ role.code }} · {{ Number(role.status) === 0 ? '启用' : '停用' }}
        <van-button size="small" :disabled="busy" @click="perform(() => readRole(role.id))">查看角色</van-button>
      </div>
      <van-button size="small" :disabled="busy || page <= 1" @click="perform(() => readList(page - 1))">上一页</van-button>
      <span> 第 {{ page }} 页 </span>
      <van-button size="small" :disabled="busy || page * 20 >= total" @click="perform(() => readList(page + 1))">下一页</van-button>
    </section>
    <section v-if="detail && !form" class="card">
      <h2>{{ detail.name }}</h2>
      <p>{{ detail.code }} · {{ Number(detail.status) === 0 ? '启用' : '停用' }}</p>
      <van-button :disabled="busy" @click="perform(() => readRole(detail!.id))">重新读取角色</van-button>
      <van-button v-if="detail.writeScopeAllowed && allowed('system:role:update')" :disabled="busy" @click="edit(detail)">编辑角色</van-button>
      <template v-if="grants">
        <p v-if="grants.menuWarning" role="alert">{{ grants.menuWarning }}</p>
        <fieldset v-if="grants.canMenus" :disabled="busy">
          <legend>功能权限</legend>
          <div class="menu-options">
            <label v-for="menu in grants.menus" :key="menu.id" class="choice">
              <input v-model="menuIds" type="checkbox" :value="menu.id"> {{ menuName(menu) }}
            </label>
          </div>
          <van-button :disabled="busy" @click="saveGrants('menus')">保存功能权限</van-button>
        </fieldset>
        <p v-if="grants.scopeWarning" role="alert">{{ grants.scopeWarning }}</p>
        <fieldset v-if="grants.canScope" :disabled="busy">
          <legend>数据范围</legend>
          <select v-model="dataScope" aria-label="数据范围">
            <option v-for="scope in scopes" :key="scope.value" :value="scope.value">{{ scope.label }}</option>
          </select>
          <template v-if="dataScope === 2">
            <label v-for="department in grants.departments" :key="department.id" class="choice">
              <input v-model="deptIds" type="checkbox" :value="department.id"> {{ department.name }}
            </label>
          </template>
          <van-button :disabled="busy" @click="saveGrants('scope')">保存数据范围</van-button>
        </fieldset>
      </template>
    </section>
    <form v-if="form" class="card" @submit.prevent="save">
      <h2>{{ form.id ? '编辑角色' : '新增角色' }}</h2>
      <van-field v-model="form.name" label="名称" maxlength="30" :disabled="busy"/>
      <van-field v-model="form.code" label="编码" maxlength="100" :disabled="busy"/>
      <van-field v-model="form.sort" label="排序" type="digit" maxlength="9" :disabled="busy"/>
      <label class="choice">状态
        <select v-model="form.status" :disabled="busy"><option :value="0">启用</option><option :value="1">停用</option></select>
      </label>
      <van-field v-model="form.remark" label="备注" maxlength="500" :disabled="busy"/>
      <van-button type="primary" native-type="submit" :disabled="busy">保存角色资料</van-button>
      <van-button :disabled="busy" @click="form = undefined">取消</van-button>
    </form>
  </template>
</template>

<style scoped>
.role-row { border-bottom: 1px solid #dce4ef; padding: 12px 0; }
.choice { display: block; padding: 8px 0; }
fieldset { margin: 12px 0; border: 1px solid #dce4ef; }
.menu-options { max-height: 320px; overflow: auto; margin-bottom: 12px; }
</style>
