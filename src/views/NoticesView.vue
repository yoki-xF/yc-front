<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

interface Notice {id:string; revision:string; title:string; type:number; status:number; content:string}
const endpoint='/system/admin-native/notices'
const pushEndpoint='/system/admin-native/notice-push'
const login=session.value?.key
let disposed=false
onUnmounted(()=>{disposed=true})
const current=()=>!disposed&&!!login&&isCurrent(login)
const can=(action:string)=>allowed('system:notice:'+action)
const rows=ref<Notice[]>([]), detail=ref<Notice>(), editor=ref<Pick<Notice,'title'|'type'|'status'|'content'>>()
const search=ref(''), applied=ref(''), page=ref(1), total=ref(0)
const busy=ref(false), error=ref(''), notice=ref('')
const pushUnknown=ref<string>()
async function perform(operation:()=>Promise<void>){
  if(busy.value||!current())return
  busy.value=true;error.value=''
  try{await operation()}
  catch(failure){if(current()&&failure!=='cancel'&&failure!=='close')error.value=(failure as Error).message}
  finally{if(current())busy.value=false}
}
async function load(next:number, query=applied.value){
  const response=await request<{list:Notice[];total:number}>(endpoint+'/page',{data:{pageNo:next,pageSize:20,search:query}})
  if(!current())return
  if(!Array.isArray(response?.list)||!Number.isSafeInteger(response.total)||response.total<0)throw Error('公告列表格式不完整')
  rows.value=response.list;total.value=response.total;page.value=next;applied.value=query
}
async function read(id:string){
  const response=await request<Notice>(endpoint+'/get',{data:{id}})
  if(current()){detail.value=response;editor.value=undefined}
}
function edit(existing?:Notice){
  if(!can(existing?'update':'create'))return
  if(!existing)detail.value=undefined
  notice.value=''
  editor.value={title:existing?.title??'',content:existing?.content??'',type:existing?.type??2,status:existing?.status??0}
}
function save(){
  return perform(async()=>{
    if(!editor.value)return
    const original=detail.value
    if(!can(original?'update':'create'))return
    const fields={...editor.value,title:editor.value.title.trim()}
    if(!fields.title||!fields.content.trim())throw Error('请输入标题和正文')
    await showConfirmDialog({title:'保存公告',message:fields.title})
    if(!current())return
    const id=identityId(await request(endpoint+'/save',{method:'POST',data:{...fields,id:original?.id,revision:original?.revision}}))
    if(!current())return
    editor.value=undefined
    notice.value='公告已保存'
    await read(id)
    await load(page.value)
  })
}
function push(){
  return perform(async()=>{
    const item=detail.value
    if(!item||item.status!==0||!can('update')||pushUnknown.value===item.id)return
    const original={id:item.id,revision:item.revision}
    const preview=await request<{count:number;audienceToken:string;requestId:string}>(pushEndpoint+'/preview',{method:'POST',data:original})
    if(!current())return
    if(!Number.isSafeInteger(preview?.count)||preview.count<1||!preview.audienceToken||!preview.requestId)throw Error('未取得有效接收范围')
    await showConfirmDialog({title:'确认实时推送',message:item.title+'\n本组织有 '+preview.count+' 个启用账号。仅在线客户端能收到实时推送。'})
    if(!current())return
    pushUnknown.value=item.id
    const result=await request<{attempted:number}>(pushEndpoint+'/send',{method:'POST',data:{...original,audienceToken:preview.audienceToken,requestId:preview.requestId}})
    if(!current())return
    if(result?.attempted!==preview.count)throw Error('推送结果待核对')
    notice.value='已尝试向 '+result.attempted+' 个账号实时推送'
    pushUnknown.value=undefined
  })
}
onMounted(()=>perform(async()=>{
  if(!identity.value)await loadAccount()
  if(current()&&can('query'))await load(1)
}))
</script>

<template>
  <div class="page-title"><h1>组织公告</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !can('query')" class="card">当前账号没有公告查询权限。</p>
  <template v-if="can('query')">
    <section class="card">
      <form @submit.prevent="perform(() => load(1,search.trim()))">
        <van-field v-model="search" label="标题" maxlength="100" :disabled="busy"/>
        <van-button native-type="submit" :disabled="busy">查询</van-button>
        <van-button v-if="can('create')" type="primary" :disabled="busy" @click="edit()">新增公告</van-button>
      </form>
      <van-empty v-if="!busy && !rows.length" description="没有匹配公告"/>
      <article v-for="row in rows" :key="row.id" class="notice-row">
        <strong>{{ row.title }}</strong> · {{ row.status===0?'启用':'停用' }}
        <van-button size="small" :disabled="busy" @click="perform(() => read(row.id))">查看公告</van-button>
      </article>
      <van-button size="small" :disabled="busy || page<=1" @click="perform(() => load(page-1))">上一页</van-button>
      <span> 第 {{ page }} 页 / 共 {{ total }} 条 </span>
      <van-button size="small" :disabled="busy || page*20>=total" @click="perform(() => load(page+1))">下一页</van-button>
    </section>
    <section v-if="detail && !editor" class="card">
      <h2>{{ detail.title }}</h2>
      <p>{{ detail.type===1?'通知':'公告' }} · {{ detail.status===0?'启用':'停用' }}</p>
      <p class="notice-content">{{ detail.content }}</p>
      <van-button v-if="can('update')" :disabled="busy" @click="edit(detail)">编辑公告</van-button>
      <van-button v-if="can('update') && detail.status===0" :disabled="busy || pushUnknown===detail.id" @click="push">预览并推送</van-button>
      <p v-if="pushUnknown===detail.id" role="status">推送结果待确认，请先核对接收情况。</p>
    </section>
    <form v-if="editor" class="card" @submit.prevent="save">
      <h2>{{ detail?'编辑公告':'新增公告' }}</h2>
      <van-field v-model="editor.title" label="公告标题" maxlength="50" :disabled="busy"/>
      <label class="notice-field">类型<select v-model="editor.type" :disabled="busy"><option :value="1">通知</option><option :value="2">公告</option></select></label>
      <label class="notice-field">状态<select v-model="editor.status" :disabled="busy"><option :value="0">启用</option><option :value="1">停用</option></select></label>
      <van-field v-model="editor.content" label="正文" type="textarea" rows="6" maxlength="10000" :disabled="busy"/>
      <van-button type="primary" native-type="submit" :disabled="busy">保存公告</van-button>
      <van-button :disabled="busy" @click="editor=undefined">取消</van-button>
    </form>
  </template>
</template>

<style scoped>
.notice-row { padding: 12px 0; border-bottom: 1px solid #dce4ef; }
.notice-field { display: block; padding: 8px 0; }
.notice-content { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
