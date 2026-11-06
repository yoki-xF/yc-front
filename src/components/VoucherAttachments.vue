<script setup lang="ts">
import {computed,onUnmounted,ref,watch} from 'vue'
import {request} from '../api/client'
const props=defineProps<{modelValue:string;deptId:string;operatingDay:string;disabled:boolean}>()
const emit=defineEmits<{ 'update:modelValue':[value:string]; busy:[value:boolean] }>()
const refs=computed(()=>props.modelValue?props.modelValue.split(','):[]),error=ref(''),busy=ref(false),preview=ref(''),previewing=ref(false)
let disposed=false,controller:AbortController|undefined
function clearPreview(){if(preview.value)URL.revokeObjectURL(preview.value);preview.value=''}
onUnmounted(()=>{disposed=true;controller?.abort();clearPreview()})
watch(()=>props.modelValue,clearPreview)
async function upload(event:Event){
 const input=event.target as HTMLInputElement,file=input.files?.[0];input.value=''
 if(!file||props.disabled||busy.value)return
 error.value=''
 if(refs.value.length>=6){error.value='凭证最多6张';return}
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||!file.size||file.size>6*1024*1024){error.value='请选择6 MB以内的 JPEG、PNG 或 WebP 图片';return}
 busy.value=true;emit('busy',true);controller?.abort();controller=new AbortController()
 try{
  const reference=await request<string>('/sport/wx/night/count/service/voucher',{method:'POST',data:{deptId:props.deptId},file,operatingDay:props.operatingDay,signal:controller.signal})
  if(!/^pv:[0-9a-f]{32}$/.test(reference))throw Error('凭证返回格式不完整')
  if(!disposed)emit('update:modelValue',[...refs.value,reference].join(','))
 }catch(e){if(!disposed)error.value=(e as Error).message||'上传结果未确认，请核对后重新选择图片'}
 finally{if(!disposed){busy.value=false;emit('busy',false)}}
}
async function view(reference:string){
 if(previewing.value||busy.value)return
 error.value='';clearPreview()
 if(!/^pv:[0-9a-f]{32}$/.test(reference)){error.value='历史公开链接暂不直接打开。原关联会保留，可以重新上传私有凭证。';return}
 previewing.value=true;controller?.abort();controller=new AbortController()
 try{const blob=await request<Blob>('/sport/wx/night/count/service/voucher',{data:{deptId:props.deptId,ref:reference},responseType:'blob',signal:controller.signal});if(!disposed)preview.value=URL.createObjectURL(blob)}
 catch(e){if(!disposed)error.value=(e as Error).message}
 finally{if(!disposed)previewing.value=false}
}
function remove(index:number){if(props.disabled||busy.value)return;emit('update:modelValue',refs.value.filter((_,i)=>i!==index).join(','))}
</script>
<template><section class="card"><h2>营业凭证 <span class="intro">{{refs.length}} / 6</span></h2><p class="intro">JPEG、PNG 或 WebP，每张不超过6 MB。上传后还需提交营业数据。</p><label v-if="refs.length<6" class="upload-field">{{busy?'正在上传…':'选择凭证图片'}}<input type="file" accept="image/png,image/jpeg,image/webp" :disabled="disabled||busy" @change="upload"></label><p v-if="error" class="error" role="alert">{{error}}</p><div v-for="(reference,index) in refs" :key="reference" class="voucher-row"><span>凭证 {{index+1}}</span><van-button size="small" native-type="button" :loading="previewing" @click="view(reference)">预览</van-button><van-button size="small" native-type="button" :disabled="disabled||busy" @click="remove(index)">取消关联</van-button></div><div v-if="preview" class="voucher-preview"><img :src="preview" alt="当前账号授权的营业凭证"><van-button size="small" native-type="button" @click="clearPreview">关闭预览</van-button></div></section></template>
