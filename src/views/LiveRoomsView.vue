<script setup lang="ts">
import {computed,nextTick,onMounted,onUnmounted,ref,watch} from 'vue'
import {useRoute} from 'vue-router'
import {departments,identity,employeeScopeError,loadAccount} from '../api/account'
import {session} from '../api/session'
import {request} from '../api/client'
const route=useRoute(),dept=ref(''),title=ref(''),rooms=ref<any[]>([]),error=ref(''),notice=ref(''),busy=ref(false)
const scope=computed(()=>session.value&&identity.value&&dept.value&&!employeeScopeError.value?`${session.value.tenantId}:${identity.value.user.id}:${dept.value}`:'')
let epoch=0
const previewVideo=ref<HTMLVideoElement|null>(null), previewRoom=ref(''), requestingRoom=ref('')
const microphoneMuted=ref(false), deviceError=ref('')
let mediaStream:MediaStream|undefined, mediaEpoch=0
function stopPreview(){
 mediaEpoch++
 mediaStream?.getTracks().forEach(track=>track.stop())
 if(previewVideo.value)previewVideo.value.srcObject=null
 mediaStream=undefined
 previewRoom.value='';requestingRoom.value='';microphoneMuted.value=false
}
async function preview(room:{id:string;canPublish:boolean}){
 if(!room.canPublish||requestingRoom.value||!session.value)return
 stopPreview();deviceError.value=''
 const attempt=mediaEpoch
 requestingRoom.value=room.id
 try{
  if(!navigator.mediaDevices?.getUserMedia)throw Error('当前浏览器或页面环境无法使用摄像头和麦克风')
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'user'},audio:true})
  if(attempt!==mediaEpoch){stream.getTracks().forEach(track=>track.stop());return}
  mediaStream=stream;previewRoom.value=room.id
  await nextTick()
  if(attempt===mediaEpoch&&previewVideo.value){
   previewVideo.value.srcObject=stream
   await previewVideo.value.play()
  }
 }catch(failure){
  if(attempt!==mediaEpoch)return
  stopPreview()
  deviceError.value=failure instanceof DOMException&&failure.name==='NotAllowedError'
   ?'摄像头或麦克风权限被拒绝，请在浏览器中授权后重试'
   :failure instanceof DOMException&&failure.name==='NotFoundError'
    ?'找不到可用的摄像头或麦克风'
    :'无法启动设备预览，请检查设备是否被其他应用占用'
 }finally{if(attempt===mediaEpoch)requestingRoom.value=''}
}
function toggleMicrophone(){
 if(!mediaStream)return
 microphoneMuted.value=!microphoneMuted.value
 mediaStream.getAudioTracks().forEach(track=>{track.enabled=!microphoneMuted.value})
}
watch(()=>session.value?.key,stopPreview,{flush:'sync'})
onUnmounted(()=>{epoch++;stopPreview()})
watch(()=>route.params.id,()=>{stopPreview();epoch++;rooms.value=[];void load()})
watch(scope,()=>{stopPreview();epoch++;rooms.value=[];title.value='';error.value='';notice.value='';if(scope.value)void load()})
function checked(raw:any){if(!raw||typeof raw.id!=='string'||!/^[a-f0-9-]{36}$/.test(raw.id)||typeof raw.title!=='string'||raw.status!=='NOT_STARTED'||typeof raw.canPublish!=='boolean')throw Error('直播间信息不完整');return raw}
async function load(){const e=epoch;error.value='';try{if(route.params.id){const room=checked(await request('/sport/live/rooms/'+encodeURIComponent(String(route.params.id))));if(e===epoch)rooms.value=[room]}else if(scope.value){const list=await request('/sport/live/rooms',{data:{deptId:dept.value}});if(!Array.isArray(list))throw Error('直播间列表不完整');if(e===epoch)rooms.value=list.map(checked)}}catch(err){if(e===epoch)error.value=(err as Error).message}}
async function create(){
 if(busy.value||!scope.value)return
 const e=epoch,key='yc-live-create-v1:'+scope.value;busy.value=true;error.value='';notice.value=''
 try{
  let command:any;const saved=localStorage.getItem(key)
  if(saved){command=JSON.parse(saved);if(command.deptId!==dept.value||typeof command.title!=='string'||typeof command.requestKey!=='string')throw Error('原创建请求损坏，请联系管理员核对')}
  else{if(!title.value.trim()||title.value.trim().length>80)throw Error('请填写1至80字的标题');command={deptId:dept.value,title:title.value.trim(),requestKey:crypto.randomUUID()};localStorage.setItem(key,JSON.stringify(command))}
  const encoded=JSON.stringify(command),room=checked(await request('/sport/live/rooms',{method:'POST',data:command}))
  if(localStorage.getItem(key)===encoded)localStorage.removeItem(key)
  if(e===epoch){title.value='';notice.value='直播间已创建，媒体接入尚在准备中。';await load()}
 }catch(err){if(e===epoch)error.value=(err as Error).message+'；若已有原请求，点击创建会核对同一请求，不会新建重复房间。'}finally{busy.value=false}
}
async function share(room:any){try{const path='/#/live/watch/'+room.id;await navigator.clipboard.writeText(new URL(path,window.location.origin).href);notice.value='观看链接已复制；目前仅限已登录且有该门店权限的账号。'}catch{notice.value='观看链接：'+new URL('/#/live/watch/'+room.id,window.location.origin).href}}
onMounted(async()=>{try{await loadAccount();dept.value=departments.value[0]?.id||'';if(route.params.id)await load()}catch(err){error.value=(err as Error).message}})
</script>
<template><div class="page-title"><p class="eyebrow">LIVE / 直播</p><h1>{{route.params.id?'直播间':'直播管理'}}</h1><p class="intro">直播间与现有组织账号绑定，观看链接与主播推流授权分开管理。</p></div><van-notice-bar wrapable text="当前为直播间业务首版，支持本机设备预览。推流和视频播放尚未接通。"/><section v-if="error" class="card error" role="alert">{{error}}</section><p v-if="deviceError" class="card error" role="alert">{{deviceError}}</p><section v-if="notice" class="card" role="status">{{notice}}</section><section v-if="!route.params.id" class="card filters"><label>所属员工门店<select v-model="dept" :disabled="busy"><option v-for="d in departments" :key="d.id" :value="d.id">{{d.name}}</option></select></label><van-field v-model="title" label="直播间标题" maxlength="80" placeholder="请输入标题" :disabled="busy"/><van-button type="primary" :loading="busy" :disabled="!scope" @click="create">创建或核对原请求</van-button></section><section class="card"><van-button :disabled="busy" @click="load">刷新直播间</van-button><van-empty v-if="!rooms.length" description="暂无可显示的直播间"/><article v-for="room in rooms" :key="room.id" class="live-room"><h2>{{room.title}}</h2><p>尚未开播 · 媒体服务准备中</p><p>{{room.canPublish?'你是该房间的创建者':'组织内观看'}}</p><van-button v-if="room.canPublish && previewRoom!==room.id" :loading="requestingRoom===room.id" :disabled="!!requestingRoom" @click="preview(room)">预览摄像头和麦克风</van-button><van-button @click="share(room)">复制观看链接</van-button><router-link :to="'/live/watch/'+room.id">打开直播间</router-link></article><div v-if="previewRoom" class="live-preview"><h2>本机预览</h2><video ref="previewVideo" autoplay muted playsinline></video><van-button @click="toggleMicrophone">{{microphoneMuted?'恢复麦克风':'静音麦克风'}}</van-button><van-button @click="stopPreview">关闭预览</van-button></div></section></template>
<style scoped>.live-room{padding:18px 0;border-bottom:1px solid var(--line);overflow-wrap:anywhere}.live-room a{display:inline-block;margin:12px}.live-preview video{display:block;width:100%;max-width:520px;margin:12px 0;background:#111;aspect-ratio:16/9;object-fit:contain}</style>
