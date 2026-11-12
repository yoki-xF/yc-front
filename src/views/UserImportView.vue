<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'

interface ImportRow { username:string; nickname:string; deptId:string; email:string; mobile:string; sex:number; status:number }
interface Preview {
  count:number; created:number; updated:number; invalid:number; canConfirm:boolean; updateExisting:boolean; token?:string
  rows:ImportRow[]; results:{line:number;username:string;action:string;valid:boolean;errors:string[]}[]
}
interface Receipt {state:string;created?:number;updated?:number}
const login=session.value?.key
let disposed=false
onUnmounted(()=>{disposed=true})
const current=()=>!disposed&&!!login&&isCurrent(login)
const endpoint='/system/admin-native/user-import'
const permitted=computed(()=>allowed('system:user:import')&&allowed('system:user:create'))
const canUpdate=computed(()=>allowed('system:user:update')&&allowed('system:user:query'))
const key=()=>['yc-import-pending-v1',session.value?.tenantId,identity.value?.user.id].join(':')
const update=ref(false), file=ref<File>(), preview=ref<Preview>(), pending=ref('')
const busy=ref(false), error=ref(''), notice=ref('')
async function perform(operation:()=>Promise<void>){
  if(!current()||busy.value)return
  busy.value=true;error.value='';notice.value=''
  try{await operation()}
  catch(failure){if(current()&&failure!=='cancel'&&failure!=='close')error.value=(failure as Error).message}
  finally{if(current())busy.value=false}
}
function choose(event:Event){
  const input=event.target as HTMLInputElement
  const item=input.files?.[0]
  input.value=''
  if(!item||busy.value||pending.value)return
  if(!item.name.toLowerCase().endsWith('.xlsx')||item.size<1||item.size>1024*1024){
    error.value='请选择 1 MB 以内的 XLSX 文件';return
  }
  error.value=''
  preview.value=undefined
  file.value=item
}
function inspect(){
  return perform(async()=>{
    if(!permitted.value||!file.value||pending.value)return
    const response=await request<Preview>(endpoint+'/preview-xlsx',{method:'POST',file:file.value,data:{updateExisting:update.value}})
    if(!current())return
    if(!Array.isArray(response?.results)||!Array.isArray(response?.rows)||response.count!==response.results.length||
      response.count!==response.rows.length||response.updateExisting!==update.value||
      (response.canConfirm&&(!response.token||response.invalid!==0)))throw Error('导入预检结果不完整')
    preview.value=response
  })
}
function settle(result:Receipt){
  if(result?.state==='completed'){
    if(!Number.isSafeInteger(result.created)||!Number.isSafeInteger(result.updated))throw Error('导入回执不完整')
    notice.value='导入完成：新增 '+result.created+' 条，更新 '+result.updated+' 条'
  }else if(result?.state==='failed'){
    notice.value='原导入已失败并回滚，请重新预检。'
  }else if(result?.state==='pending'||result?.state==='not-found'){
    notice.value='暂未取得最终回执，请稍后查询原导入结果。'
    return
  }else throw Error('导入回执状态无效')
  if(localStorage.getItem(key())===pending.value)localStorage.removeItem(key())
  pending.value=''
  preview.value=undefined
  file.value=undefined
}
function confirmImport(){
  return perform(async()=>{
    const checked=preview.value
    if(!checked?.canConfirm||!checked.token||!permitted.value||pending.value)return
    await showConfirmDialog({title:'确认导入员工',message:'新增 '+checked.created+' 条，更新 '+checked.updated+' 条。预检回执有效期为 5 分钟。'})
    if(!current())return
    if(localStorage.getItem(key())!==null)throw Error('已有待核对的导入，请刷新页面')
    localStorage.setItem(key(),checked.token)
    pending.value=checked.token
    const result=await request<Receipt>(endpoint+'/confirm',{method:'POST',data:{token:checked.token,rows:checked.rows,updateExisting:checked.updateExisting}})
    if(current())settle(result)
  })
}
function result(){
  return perform(async()=>{
    if(!pending.value)return
    const response=await request<Receipt>(endpoint+'/result',{data:{token:pending.value}})
    if(current())settle(response)
  })
}
function download(){
  return perform(async()=>{
    if(!permitted.value)return
    const blob=await request<Blob>(endpoint+'/template',{responseType:'xlsx'})
    if(!current())return
    const url=URL.createObjectURL(blob), link=document.createElement('a')
    link.href=url;link.download='员工导入模板.xlsx';link.click()
    setTimeout(()=>URL.revokeObjectURL(url),1000)
  })
}
onMounted(()=>perform(async()=>{
  if(!identity.value)await loadAccount()
  if(current()&&permitted.value)pending.value=localStorage.getItem(key())??''
}))
</script>

<template>
  <div class="page-title"><h1>批量导入员工</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !permitted" class="card">当前账号没有员工导入权限。</p>
  <template v-if="permitted">
    <section v-if="pending" class="card">
      <p>有一批导入等待核对结果。</p>
      <van-button type="primary" :disabled="busy" @click="result">查询原导入结果</van-button>
    </section>
    <section v-else class="card">
      <van-button plain :disabled="busy" @click="download">下载 XLSX 模板</van-button>
      <p>每批最多 200 行，门店编号请以文本填写。</p>
      <p v-if="canUpdate"><label><input v-model="update" type="checkbox" :disabled="busy" @change="preview=undefined"> 允许更新已有员工</label></p>
      <label>选择 XLSX 文件 <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" :disabled="busy" @change="choose"></label>
      <p v-if="file">{{ file.name }}</p>
      <van-button type="primary" :disabled="busy || !file" @click="inspect">预检文件</van-button>
    </section>
    <section v-if="preview" class="card">
      <h2>逐行预检</h2>
      <p>共 {{ preview.count }} 条，新增 {{ preview.created }} 条，更新 {{ preview.updated }} 条，无效 {{ preview.invalid }} 条。</p>
      <ul>
        <li v-for="row in preview.results" :key="row.line">
          第 {{ row.line }} 行 · {{ row.username || '空账号' }} · {{ row.valid ? (row.action==='create'?'新增':'更新') : row.errors.join('；') }}
        </li>
      </ul>
      <van-button v-if="preview.canConfirm && !pending" type="primary" :disabled="busy" @click="confirmImport">确认导入</van-button>
    </section>
  </template>
</template>
