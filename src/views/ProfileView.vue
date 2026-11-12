<script setup lang="ts">
import { onMounted,onUnmounted,ref,watch } from 'vue'
import { showConfirmDialog } from 'vant'
import { request } from '../api/client'
import { session } from '../api/session'
import { identity } from '../api/account'
import { profile,profileCommand,type Profile } from '../domain/user-profile'
const value=ref<Profile|null>(null),busy=ref(false),uncertain=ref(false),error=ref(''),success=ref('')
const avatar=ref('')
const login=session.value?.key
function avatarUrl(raw:unknown){
 if(typeof raw!=='string'||!raw.trim())return ''
 try{
  const url=new URL(raw,window.location.origin)
  return ['http:','https:'].includes(url.protocol)?url.href:''
 }catch{return ''}
}
async function uploadAvatar(event:Event){
 const input=event.target as HTMLInputElement
 const file=input.files?.[0]
 input.value=''
 if(!file||busy.value||uncertain.value||!value.value||!current())return
 error.value='';success.value=''
 if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size===0||file.size>2*1024*1024){
  error.value='请选择 2 MB 以内的 JPEG、PNG 或 WebP 图片'
  return
 }
 busy.value=true
 controller?.abort()
 controller=new AbortController()
 try{
  uncertain.value=true
  const result=await request('/system/boss/profile/avatar',{method:'POST',file,fileField:'avatarFile',signal:controller.signal})
  if(!current())return
  const url=avatarUrl(result)
  if(!url)throw Error('头像回执不完整，请读取服务器资料核对')
  avatar.value=url
  uncertain.value=false
  success.value='头像已保存'
 }catch(e){if(current())error.value=(e as Error).message}
 finally{if(current())busy.value=false}
}
let disposed=false,controller:AbortController|undefined
const current=()=>!disposed&&!!login&&session.value?.key===login
watch(()=>session.value?.key,()=>{if(!current()){controller?.abort();value.value=null;avatar.value='';error.value='账号已变化，请重新进入个人资料';busy.value=false;success.value=''}})
onUnmounted(()=>{disposed=true;controller?.abort()})
async function load(){
 if(busy.value||!current())return
 busy.value=true;value.value=null;error.value='';success.value='';controller?.abort();controller=new AbortController()
 try{const raw=await request('/system/user/profile/get',{signal:controller.signal});if(current()){value.value=profile(raw);avatar.value=avatarUrl(raw.avatar);uncertain.value=false}}
 catch(e){if(current())error.value=(e as Error).message}
 finally{if(current())busy.value=false}
}
async function save(){
 if(busy.value||!current()||!value.value||uncertain.value)return
 let command
 try{command=profileCommand(value.value)}catch(e){error.value=(e as Error).message;return}
 busy.value=true;error.value='';success.value=''
 try{
  await showConfirmDialog({title:'确认更新个人资料',message:'仅更新当前账号的姓名、联系方式及性别。请核对后保存。'})
  if(!current())return
  uncertain.value=true
  const result=await request('/system/user/profile/update',{method:'PUT',data:command})
  if(!current())return
  if(result!==true)throw Error('保存回执不完整，请读取服务器资料核对')
  if(identity.value?.user.id===value.value.id)identity.value={...identity.value,user:{...identity.value.user,nickname:command.nickname}}
  success.value='个人资料已保存，请读取服务器资料核对。'
 }catch(e){if(current()&&e!=='cancel'&&e!=='close')error.value=(e as Error).message||'保存结果未确认，请读取服务器资料核对'}
 finally{if(current())busy.value=false}
}
onMounted(load)
</script>
<template><router-link to="/mine" class="text-link">← 返回我的账号</router-link><div class="page-title"><h1>个人资料</h1><p class="intro">让同事更容易认出你，联系方式由你维护。</p></div><p v-if="error" class="card error" role="alert">{{error}}</p><p v-if="success" class="card success" role="status">{{success}}</p><van-notice-bar v-if="uncertain&&!busy" wrapable text="本次保存已发送，请读取服务器资料核对后再修改，避免重复提交。"/><section v-if="value" class="card">
 <div class="profile-select">
  <img v-if="avatar" :src="avatar" alt="当前头像" width="64" height="64" style="object-fit: cover; border-radius: 50%" referrerpolicy="no-referrer">
  <label>更换头像<input type="file" accept="image/jpeg,image/png,image/webp" :disabled="busy||uncertain" @change="uploadAvatar"></label>
 </div>
 <van-field :model-value="value.username" label="账号" readonly/><van-field :model-value="`yc-${value.id}`" label="专属登录号" readonly/><van-field v-model="value.nickname" label="姓名或昵称" maxlength="30" :disabled="busy||uncertain"/><van-field v-model="value.mobile" label="联系电话" inputmode="tel" maxlength="11" placeholder="选填" :disabled="busy||uncertain"/><van-field v-model="value.email" label="邮箱" inputmode="email" maxlength="50" placeholder="选填" :disabled="busy||uncertain"/><label class="profile-select">性别<select v-model="value.sex" :disabled="busy||uncertain"><option value="0">未设置</option><option value="1">男</option><option value="2">女</option></select></label><van-button type="primary" block :loading="busy" :disabled="uncertain||!current()" @click="save">保存个人资料</van-button></section><van-button block plain :loading="busy" :disabled="!current()" @click="load">读取服务器资料</van-button></template>
