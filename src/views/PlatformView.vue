<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { showConfirmDialog } from 'vant'
import { identityId } from '../domain/account-login'
import { allowed, canManagePlatform, loadAccount } from '../api/account'
import { request } from '../api/client'
import { session } from '../api/session'
type Kind = 'tenants' | 'packages'
type Row = { id: string; name: string; status: number }
const kind = ref<Kind>('tenants'), page = ref(1), total = ref(0), search = ref(''), applied = ref('')
const rows = ref<Row[]>([]), busy = ref(false), error = ref('')
type Editor = {
  id?:string; revision?:string; name:string; status:number; systemTenant?:boolean
  contactName:string; contactMobile:string; website:string; packageId:string; expireTime:string
  accountCount:string; username:string; password:string; remark:string; taxNo:string; email:string
  menuIds:string[]
}
const base='/system/admin-native/platform'
const editor=ref<Editor>(), menuOptions=ref<{id:string;name:string}[]>([]), packageOptions=ref<Row[]>([])
const notice=ref(''), menuFilter=ref('')
const detail=ref<{row:Row;fields:[string,string][]}>()
const visibleMenus=computed(()=>menuOptions.value.filter(item=>item.name.includes(menuFilter.value.trim())))
const legacyMenus=computed(()=>editor.value?.menuIds.filter(id=>!menuOptions.value.some(item=>item.id===id))??[])
function resetEditor(){detail.value=undefined;editor.value=undefined;menuOptions.value=[];packageOptions.value=[];menuFilter.value='';notice.value=''}

const authorized = computed(() => !!session.value && canManagePlatform())
const query = (value:Kind) => allowed((value==='tenants'?'system:tenant:':'system:tenant-package:')+'query')
const can = (action:string) => allowed((kind.value==='tenants'?'system:tenant:':'system:tenant-package:')+action)
let serial = 0
function clear() { serial++; rows.value = []; total.value = 0; busy.value = false; error.value = '' }
watch(() => session.value?.key, () => { clear(); resetEditor() }, { flush: 'sync' })
onUnmounted(clear)
async function load() {
  clear()
  if (!authorized.value || !query(kind.value)) return
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
  try { await loadAccount(); if (key === session.value?.key) { if (!query(kind.value) && query('packages')) kind.value='packages'; await load() } }
  catch (err) { if (key === session.value?.key) error.value = (err as Error).message }
  finally { if (key === session.value?.key) busy.value = false }
}
function filter() { page.value = 1; applied.value = search.value.trim(); void load() }
function choose(value: Kind) {
  if (busy.value || kind.value===value) return
  resetEditor()
  kind.value = value
  search.value = ''
  filter()
}
async function perform(operation:(token:number)=>Promise<void>){
  if(!authorized.value||busy.value)return
  const token=serial
  busy.value=true;error.value=''
  try{await operation(token)}
  catch(err){if(token===serial&&err!=='cancel'&&err!=='close')error.value=(err as Error).message}
  finally{if(token===serial)busy.value=false}
}
function newEditor(row?:Row, readOnly=false){
  return perform(async token=>{
    const selected=kind.value
    const original=row ? await request(base+'/'+selected+'/get',{data:{id:row.id}}) : {}
    if(token!==serial||!authorized.value)return
    if (row && (original?.id!==row.id || typeof original.name!=='string' || ![0,1].includes(original.status))) throw Error('平台详情返回格式不完整')
    if (row && readOnly) {
      editor.value=undefined
      const fields:[string,string][]=[['状态',original.status===0?'启用':'停用']]
      if (selected==='tenants') {
        fields.push(['组织类型',original.systemTenant===true?'系统组织':'客户组织'])
        if(typeof original.expireTime==='string'&&original.expireTime)fields.push(['有效期',original.expireTime.replace('T',' ')])
        if(Number.isSafeInteger(original.accountCount))fields.push(['账号配额',String(original.accountCount)])
      } else if(Array.isArray(original.menuIds))fields.push(['配置菜单数',String(original.menuIds.length)])
      detail.value={row:{id:row.id,name:original.name,status:original.status},fields}
      return
    }
    if(selected==='packages'){
      const choices=await request<{id:string;name:string}[]>(base+'/package-menus')
      if(token!==serial||!authorized.value)return
      menuOptions.value=choices
    }else if(!original.systemTenant){
      const options:Row[]=[]
      let index=1, expected=0
      do{
        const data=await request<{list:Row[];total:number}>(base+'/packages/page',{data:{pageNo:index++,pageSize:50}})
        if(token!==serial||!authorized.value)return
        expected=data.total
        if(!Number.isSafeInteger(expected)||expected>5000||!Array.isArray(data.list)||(!data.list.length&&options.length<expected))throw Error('套餐列表不完整')
        options.push(...data.list)
      }while(options.length<expected)
      packageOptions.value=options.filter(item=>item.status===0||item.id===String(original.packageId))
    }
    detail.value=undefined
    menuFilter.value=''
    editor.value={
      id:row?.id,revision:original.revision,systemTenant:original.systemTenant,name:String(original.name??''),status:Number(original.status??0),
      contactName:String(original.contactName??''),contactMobile:String(original.contactMobile??''),website:String(original.website??''),
      packageId:String(original.packageId??''),expireTime:String(original.expireTime??''),accountCount:String(original.accountCount??'10'),
      username:'',password:'',remark:String(original.remark??''),taxNo:String(original.taxNo??''),email:String(original.email??''),
      menuIds:Array.isArray(original.menuIds)?original.menuIds.map(identityId):[],
    }
  })
}
function save(){
  return perform(async token=>{
    const form=editor.value
    if(!form||form.systemTenant||!can(form.id?'update':'create'))return
    const {id,revision,name,status}=form
    if(!name.trim())throw Error('请输入名称')
    let fields:Record<string,unknown>
    if(kind.value==='packages'){
      if(!form.menuIds.length)throw Error('请选择套餐权限')
      fields={name:name.trim(),status,remark:form.remark,menuIds:[...form.menuIds]}
    }else{
      const accountCount=Number(form.accountCount)
      const expireTime=form.expireTime.length===16?form.expireTime+':00':form.expireTime
      if(!form.contactName.trim()||!form.packageId||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(expireTime)||!Number.isInteger(accountCount)||accountCount<1||accountCount>1000000)throw Error('请填写联系人、有效期、套餐和有效账号配额')
      if(!id&&(!form.username.trim()||form.password.length<4||form.password.length>16))throw Error('请输入管理员账号和 4 至 16 位初始密码')
      fields={name:name.trim(),status,contactName:form.contactName.trim(),contactMobile:form.contactMobile,website:form.website,
        packageId:identityId(form.packageId),expireTime,accountCount,taxNo:form.taxNo,email:form.email,
        ...(!id?{username:form.username.trim(),password:form.password}:{})}
    }
    await showConfirmDialog({title:'保存'+(kind.value==='tenants'?'组织':'套餐'),message:name})
    if(token!==serial||!authorized.value)return
    const result=await request(base+'/'+kind.value+'/save',{method:'POST',data:{id,revision,fields}})
    if(token!==serial||!authorized.value)return
    identityId(result)
    resetEditor()
    notice.value='已保存，列表已刷新'
    await load()
  })
}
function retire(){
  return perform(async token=>{
    const form=editor.value
    if(!form?.id||form.systemTenant||!can('delete'))return
    const tenant=kind.value==='tenants'
    const label=tenant?'停用组织':'删除未使用套餐'
    await showConfirmDialog({title:label,message:form.name})
    if(token!==serial||!authorized.value)return
    const result=await request(base+'/'+kind.value+'/retire',{method:'POST',data:{id:form.id,revision:form.revision}})
    if(token!==serial||!authorized.value)return
    if(result!==true)throw Error('操作回执不完整，请刷新列表核对')
    resetEditor()
    notice.value=label+'成功'
    await load()
  })
}
onMounted(initialize)
</script>

<template>
  <div class="page-title"><h1>平台管理</h1><p class="intro">维护组织、账号配额及套餐权限。</p></div>
  <section v-if="error" role="alert" class="card error">{{ error }}</section>
  <p v-if="notice" role="status" class="card success">{{ notice }}</p>
  <van-loading v-if="busy" />
  <van-empty v-else-if="!authorized && !error" description="此功能仅对平台管理员开放" />
  <template v-if="authorized">
    <section class="card">
      <van-button v-if="query('tenants')" :type="kind === 'tenants' ? 'primary' : 'default'" :disabled="busy" @click="choose('tenants')">组织</van-button>
      <van-button v-if="query('packages')" :type="kind === 'packages' ? 'primary' : 'default'" :disabled="busy" @click="choose('packages')">套餐</van-button>
      <form @submit.prevent="filter">
        <van-field v-model="search" maxlength="100" label="名称" placeholder="搜索名称" />
        <van-button native-type="submit" :disabled="busy">搜索</van-button>
        <van-button v-if="can('create')" type="primary" :disabled="busy" @click="newEditor()">新增{{ kind === 'tenants' ? '组织' : '套餐' }}</van-button>
      </form>
    </section>
    <section class="card">
      <van-empty v-if="!busy && !error && !rows.length" description="没有匹配记录" />
      <van-cell v-for="row in rows" :key="row.id" :title="row.name" :value="row.status===0?'启用':'停用'" is-link :clickable="!busy" @click="newEditor(row,true)"/>
      <van-button :disabled="busy || page <= 1" @click="page--; load()">上一页</van-button>
      <span> 第 {{ page }} 页 / 共 {{ total }} 条 </span>
      <van-button :disabled="busy || page * 20 >= total || page >= 100000" @click="page++; load()">下一页</van-button>
    </section>
    <section v-if="detail" class="card">
      <h2>{{ detail.row.name }}</h2>
      <dl><div v-for="[label,value] in detail.fields" :key="label"><dt>{{ label }}</dt><dd>{{ value }}</dd></div></dl>
      <van-button v-if="can('update') || can('delete')" :disabled="busy" @click="newEditor(detail.row)">维护配置</van-button>
      <van-button :disabled="busy" @click="resetEditor">关闭详情</van-button>
    </section>
    <form v-if="editor" class="card" @submit.prevent="save">
      <h2>{{ editor.id ? '编辑' : '新增' }}{{ kind === 'tenants' ? '组织' : '套餐' }}</h2>
      <p v-if="editor.systemTenant">系统组织 · {{ editor.name }}</p>
      <fieldset v-else :disabled="busy">
        <van-field v-model="editor.name" label="名称" maxlength="100" :disabled="busy"/>
        <label class="platform-field">状态<select v-model="editor.status"><option :value="0">启用</option><option :value="1">停用</option></select></label>
        <template v-if="kind==='tenants'">
          <van-field v-model="editor.contactName" label="联系人" :disabled="busy"/>
          <van-field v-model="editor.contactMobile" label="联系手机" :disabled="busy"/>
          <van-field v-model="editor.website" label="绑定域名" :disabled="busy"/>
          <van-field v-model="editor.email" label="联系邮箱" :disabled="busy"/>
          <van-field v-model="editor.taxNo" label="税号" :disabled="busy"/>
          <label class="platform-field">套餐<select v-model="editor.packageId"><option value="">请选择</option>
            <option v-for="item in packageOptions" :key="item.id" :value="item.id">{{ item.name }}</option>
          </select></label>
          <label class="platform-field">有效期（北京时间）<input v-model="editor.expireTime" type="datetime-local" step="1"></label>
          <van-field v-model="editor.accountCount" type="digit" label="账号配额" :disabled="busy"/>
          <template v-if="!editor.id">
            <van-field v-model="editor.username" label="管理员账号" autocomplete="off" :disabled="busy"/>
            <van-field v-model="editor.password" label="初始密码" type="password" maxlength="16" autocomplete="new-password" :disabled="busy"/>
          </template>
        </template>
        <template v-else>
          <van-field v-model="editor.remark" label="备注" :disabled="busy"/>
          <van-field v-model="menuFilter" label="筛选权限" :disabled="busy"/>
          <p>已选择 {{ editor.menuIds.length }} 项权限</p>
          <p v-if="legacyMenus.length">当前套餐保留 {{ legacyMenus.length }} 项历史权限。</p>
          <div class="platform-menus">
            <label v-for="item in visibleMenus" :key="item.id" class="platform-field">
              <input v-model="editor.menuIds" type="checkbox" :value="item.id"> {{ item.name }}
            </label>
          </div>
        </template>
        <van-button v-if="can(editor.id ? 'update' : 'create')" native-type="submit" type="primary" :disabled="busy">保存</van-button>
        <van-button v-if="editor.id && can('delete') && (kind==='packages'||editor.status===0)" :disabled="busy" @click="retire">{{ kind==='tenants' ? '停用组织' : '删除未使用套餐' }}</van-button>
      </fieldset>
      <van-button :disabled="busy" @click="resetEditor">关闭</van-button>
    </form>
  </template>
</template>
<style scoped>
fieldset { margin: 12px 0; border: 1px solid #dce4ef; }
.platform-field { display: block; padding: 8px 0; }
.platform-field select, .platform-field input:not([type=checkbox]) { display: block; max-width: 100%; }
.platform-menus { max-height: 300px; overflow: auto; }
</style>
