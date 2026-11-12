<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'
import { display } from '../domain/resources.js'

interface Message {id:string|number; templateNickname:string; templateContent:string; readStatus:boolean; createTime:string|number}
const base='/system/notify-message'
const login=session.value?.key
let disposed=false
onUnmounted(()=>{disposed=true})
const current=()=>!disposed&&!!login&&isCurrent(login)
const messages=ref<Message[]>([]), expanded=ref(''), page=ref(1), total=ref(0), unread=ref(false)
const busy=ref(false), error=ref('')
async function perform(operation:()=>Promise<void>){
  if(busy.value||!current())return
  busy.value=true;error.value=''
  try{await operation()}
  catch(failure){if(current()&&failure!=='cancel'&&failure!=='close')error.value=(failure as Error).message}
  finally{if(current())busy.value=false}
}
async function load(next:number){
  const data=await request<{list:Message[];total:number}>(base+'/my-page',{data:{pageNo:next,pageSize:20,...(unread.value?{readStatus:false}:{})}})
  if(!current())return
  if(!Array.isArray(data?.list)||!Number.isSafeInteger(data.total)||data.total<0)throw Error('站内通知列表格式不完整')
  for(const message of data.list)identityId(message.id)
  if(next>1&&!data.list.length){await load(next-1);return}
  messages.value=data.list;page.value=next;total.value=data.total
}
function open(message:Message){expanded.value=expanded.value===String(message.id)?'':String(message.id)}
function mark(message?:Message){
  return perform(async()=>{
    const id=message?identityId(message.id):''
    if(!message)await showConfirmDialog({title:'全部标为已读',message:'将本账号所有未读站内通知标为已读。'})
    if(!current())return
    const result=await request(base+(id?'/update-read?ids='+encodeURIComponent(id):'/update-all-read'),{method:'PUT'})
    if(result!==true)throw Error('更新回执不完整，请刷新列表')
    if(current())await load(page.value)
  })
}
onMounted(()=>perform(()=>load(1)))
</script>

<template>
  <div class="page-title"><h1>站内通知</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <section class="card">
    <label><input v-model="unread" type="checkbox" :disabled="busy" @change="perform(() => load(1))"> 仅看未读</label>
    <van-button :disabled="busy" @click="perform(() => load(page))">刷新</van-button>
    <van-button :disabled="busy" @click="mark()">全部标为已读</van-button>
    <van-empty v-if="!busy && !messages.length" description="暂无站内通知"/>
    <article v-for="item in messages" :key="item.id" class="message-row">
      <strong>{{ item.templateNickname || '系统通知' }}</strong> · {{ item.readStatus?'已读':'未读' }}
      <p>{{ display(item.createTime,'createTime') }}</p>
      <van-button size="small" @click="open(item)">{{ expanded===String(item.id)?'收起':'查看正文' }}</van-button>
      <van-button v-if="!item.readStatus" size="small" :disabled="busy" @click="mark(item)">标为已读</van-button>
      <p v-if="expanded===String(item.id)" class="message-content">{{ item.templateContent }}</p>
    </article>
    <van-button size="small" :disabled="busy || page<=1" @click="perform(() => load(page-1))">上一页</van-button>
    <span> 第 {{ page }} 页 / 共 {{ total }} 条 </span>
    <van-button size="small" :disabled="busy || page*20>=total" @click="perform(() => load(page+1))">下一页</van-button>
  </section>
</template>

<style scoped>
.message-row { padding: 12px 0; border-bottom: 1px solid #dce4ef; }
.message-content { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
