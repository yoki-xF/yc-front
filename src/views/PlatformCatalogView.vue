<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

type Field = [key:string, label:string, type?:'number'|'status'|'menu-type'|'boolean']
const catalog = {
  posts: {label:'岗位', permission:'system:post', immutable:[], fields:[
    ['name','岗位名称'],['code','岗位编码'],['sort','排序','number'],['status','状态','status'],['remark','备注'],
  ] as Field[]},
  'dict-types': {label:'字典类型', permission:'system:dict', immutable:['type'], fields:[
    ['name','字典名称'],['type','字典编码'],['status','状态','status'],['remark','备注'],
  ] as Field[]},
  'dict-data': {label:'字典数据', permission:'system:dict', immutable:['dictType','value'], fields:[
    ['dictType','所属字典编码'],['label','显示名称'],['value','键值'],['sort','排序','number'],
    ['status','状态','status'],['colorType','颜色类型'],['cssClass','样式类名'],['remark','备注'],
  ] as Field[]},
  menus: {label:'菜单', permission:'system:menu', immutable:[], fields:[
    ['name','菜单名称'],['parentId','上级菜单编号（0 为顶级）'],['type','菜单类型','menu-type'],['sort','排序','number'],
    ['permission','权限标识'],['path','路由地址'],['icon','图标'],['component','组件路径'],['componentName','组件名称'],
    ['status','状态','status'],['visible','显示','boolean'],['keepAlive','缓存','boolean'],['alwaysShow','始终显示','boolean'],
  ] as Field[]},
}
type Kind = keyof typeof catalog
type Row = {id:string; label:string; name?:string; status:number; parentId?:string; depth?:number; dictType?:string}
type Detail = Record<string,unknown>
const login = session.value?.key
let disposed=false
const current=()=>!disposed&&!!login&&isCurrent(login)
onUnmounted(()=>{disposed=true})
const base='/system/admin-native'
const path=(kind:Kind)=>base+(kind==='posts'?'/posts':'/global/'+kind)
const isPlatform=computed(()=>identity.value?.roles?.includes('super_admin')===true)
const tabs=computed(()=>(Object.keys(catalog) as Kind[]).filter(key=>(key==='posts'||isPlatform.value)&&allowed(catalog[key].permission+':query')))
const kind=ref<Kind>('dict-types')
const active=computed<{label:string;permission:string;immutable:string[];fields:Field[]}>(()=>catalog[kind.value])
const can=(action:string)=>(kind.value==='posts'||isPlatform.value)&&allowed(active.value.permission+':'+action)
const rows=ref<Row[]>([]), detail=ref<Detail>(), editor=ref<Record<string,string|number|boolean>>()
const page=ref(1), total=ref(0), search=ref(''), applied=ref(''), dictFilter=ref(''), appliedDict=ref('')
const busy=ref(false), error=ref(''), notice=ref('')
const tree=computed(()=>kind.value==='menus')
const defaults:Record<string,string|number|boolean>={status:0,sort:0,parentId:'0',type:1,visible:true,keepAlive:true,alwaysShow:true}
async function perform(operation:()=>Promise<void>){
  if(!current()||busy.value)return
  busy.value=true;error.value=''
  try{await operation()}
  catch(failure){if(current()&&failure!=='cancel'&&failure!=='close')error.value=(failure as Error).message}
  finally{if(current())busy.value=false}
}
async function readPage(next:number, query=applied.value, dict=appliedDict.value){
  if(!can('query'))return
  const route=tree.value?'/tree':'/page'
  const data=tree.value?{search:query}:{search:query,dictType:dict,pageNo:next,pageSize:20}
  const response=await request<{list:Row[];total:number}>(path(kind.value)+route,{data})
  if(!current())return
  if(!Array.isArray(response?.list)||!Number.isSafeInteger(response.total)||response.total<0)throw Error('配置列表格式不完整')
  rows.value=response.list.map(row=>({...row,label:row.label??row.name??''}));total.value=response.total;page.value=next;applied.value=query;appliedDict.value=dict
}
function select(target:Kind, initialDict=''){
  return perform(async()=>{
    kind.value=target;detail.value=undefined;editor.value=undefined;rows.value=[];total.value=0
    page.value=1;search.value='';applied.value='';dictFilter.value=initialDict;appliedDict.value=initialDict;notice.value=''
    await readPage(1)
  })
}
async function read(id:string){
  const result=await request<Detail>(path(kind.value)+'/get',{data:{id}})
  if(current()){detail.value=result;editor.value=undefined}
}
function edit(original?:Detail){
  if(!can(original?'update':'create'))return
  if(!original)detail.value=undefined
  notice.value=''
  editor.value=Object.fromEntries(active.value.fields.map(([key,,type])=>{
    const fallback=key==='type'&&kind.value==='dict-types'?'':key==='dictType'?dictFilter.value:defaults[key]??''
    const raw=original?.[key]??fallback
    if(type==='boolean')return [key,raw===true]
    if(type==='status'||type==='menu-type')return [key,Number(raw)]
    return [key,String(raw)]
  }))
}
function save(){
  return perform(async()=>{
    const form=editor.value, original=detail.value
    if(!form||!can(original?'update':'create'))return
    const fields:Record<string,unknown>={}
    for(const [key,label,type] of active.value.fields){
      const value=form[key]
      if(type==='number'){
        if(!/^\d{1,9}$/.test(String(value)))throw Error('请填写有效的'+label)
        fields[key]=Number(value)
      }else fields[key]=typeof value==='string'?value.trim():value
    }
    const primary=String(fields.name??fields.label??'')
    if(!primary)throw Error('请填写名称')
    if(kind.value==='menus'&&!/^(0|[1-9]\d*)$/.test(String(fields.parentId)))throw Error('请选择有效上级菜单编号')
    if(kind.value==='posts'&&!fields.code)throw Error('请填写岗位编码')
    if(kind.value==='dict-types'&&!fields.type)throw Error('请填写字典编码')
    if(kind.value==='dict-data'&&(!fields.dictType||!fields.value))throw Error('请填写所属字典编码及键值')
    await showConfirmDialog({title:'保存'+active.value.label,message:primary})
    if(!current())return
    const response=await request(path(kind.value)+'/save',{method:'POST',data:{id:original?.id,revision:original?.revision,...(kind.value==='posts'?fields:{fields})}})
    if(!current())return
    const id=identityId(response)
    editor.value=undefined
    notice.value='配置已保存'
    await read(id)
    await readPage(page.value)
  })
}
function download(){
  return perform(async()=>{
    if(!can('export')||tree.value)return
    const csv=await request<string>(base+'/exports/'+kind.value,{data:{search:applied.value,dictType:appliedDict.value}})
    if(!current())return
    if(typeof csv!=='string')throw Error('导出回执不完整')
    const url=URL.createObjectURL(new Blob(['\ufeff',csv],{type:'text/csv;charset=utf-8'})), link=document.createElement('a')
    link.href=url;link.download=active.value.label+'.csv';link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  })
}
function searchRows(){return perform(()=>readPage(1,search.value.trim(),dictFilter.value.trim()))}
onMounted(async()=>{
  await perform(async()=>{if(!identity.value)await loadAccount()})
  const first=tabs.value.includes('dict-types')?'dict-types':tabs.value[0]
  if(first)await select(first)
})
</script>

<template>
  <div class="page-title"><h1>岗位、字典与菜单</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !tabs.length" class="card">当前账号没有岗位、字典或菜单查询权限。</p>
  <template v-if="tabs.length">
    <section class="card">
      <van-button v-for="tab in tabs" :key="tab" size="small" :type="kind===tab?'primary':'default'" :disabled="busy" @click="select(tab)">{{ catalog[tab].label }}</van-button>
      <form @submit.prevent="searchRows">
        <van-field v-model="search" label="搜索名称" maxlength="100" :disabled="busy"/>
        <van-field v-if="kind==='dict-data'" v-model="dictFilter" label="字典编码" maxlength="100" :disabled="busy"/>
        <van-button native-type="submit" :disabled="busy">查询</van-button>
        <van-button v-if="!tree && can('export')" :disabled="busy" @click="download">导出查询结果</van-button>
        <van-button v-if="can('create')" type="primary" :disabled="busy" @click="edit()">新增{{ active.label }}</van-button>
      </form>
    </section>
    <section class="card">
      <van-empty v-if="!busy && !rows.length" description="没有匹配记录"/>
      <article v-for="row in rows" :key="row.id" class="catalog-row" :style="{paddingInlineStart:Math.min(row.depth??0,8)*12+'px'}">
        <strong>{{ row.label }}</strong>
        <span> {{ row.dictType || row.id }} · {{ row.status===0?'启用':'停用' }}</span>
        <van-button size="small" :disabled="busy" @click="perform(() => read(row.id))">查看</van-button>
        <van-button v-if="row.dictType && kind==='dict-types'" size="small" :disabled="busy" @click="select('dict-data',row.dictType)">查看字典数据</van-button>
      </article>
      <template v-if="!tree">
        <van-button size="small" :disabled="busy || page<=1" @click="perform(() => readPage(page-1))">上一页</van-button>
        <span> 第 {{ page }} 页 / 共 {{ total }} 条 </span>
        <van-button size="small" :disabled="busy || page*20>=total" @click="perform(() => readPage(page+1))">下一页</van-button>
      </template>
    </section>
    <section v-if="detail && !editor" class="card">
      <h2>{{ active.label }}详情</h2>
      <dl><div v-for="[key,label,type] in active.fields" :key="key"><dt>{{ label }}</dt>
        <dd>{{ type==='status' ? (Number(detail[key])===0?'启用':'停用') : String(detail[key]??'—') }}</dd>
      </div></dl>
      <van-button v-if="can('update')" :disabled="busy" @click="edit(detail)">编辑配置</van-button>
    </section>
    <form v-if="editor" class="card" @submit.prevent="save">
      <h2>{{ detail?'编辑':'新增' }}{{ active.label }}</h2>
      <template v-for="[key,label,type] in active.fields" :key="key">
        <label v-if="type==='boolean'" class="catalog-field"><input v-model="editor[key]" type="checkbox" :disabled="busy"> {{ label }}</label>
        <label v-else-if="type==='status' || type==='menu-type'" class="catalog-field">{{ label }}
          <select v-model="editor[key]" :disabled="busy">
            <template v-if="type==='status'"><option :value="0">启用</option><option :value="1">停用</option></template>
            <template v-else><option :value="1">目录</option><option :value="2">菜单</option><option :value="3">按钮</option></template>
          </select>
        </label>
        <van-field v-else :model-value="String(editor[key] ?? '')" @update:model-value="editor[key]=$event" :label="label" :type="type==='number'?'digit':'text'" :disabled="busy || (!!detail && active.immutable.includes(key))"/>
      </template>
      <van-button native-type="submit" type="primary" :disabled="busy">保存配置</van-button>
      <van-button :disabled="busy" @click="editor=undefined">取消</van-button>
    </form>
  </template>
</template>

<style scoped>
.catalog-row { border-bottom: 1px solid #dce4ef; padding: 12px 0; overflow-wrap: anywhere; }
.catalog-field { display: block; padding: 8px 0; }
</style>
