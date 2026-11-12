<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { allowed, identity, loadAccount } from '../api/account'
import { request } from '../api/client'
import { isCurrent, session } from '../api/session'
import { identityId } from '../domain/account-login'

type Kind='notify-templates'|'notify-messages'
type Row=Record<string,unknown>
type Template={name:string;code:string;nickname:string;type:string;content:string;status:number;remark:string}
const base='/system/admin-native/messages/'
const login=session.value?.key
let disposed=false
onUnmounted(()=>{disposed=true})
const current=()=>!disposed&&!!login&&isCurrent(login)
const kind=ref<Kind>('notify-templates')
const superAdmin=()=>identity.value?.roles?.includes('super_admin')===true
const can=(type:Kind,action:string)=>superAdmin()&&allowed('system:'+(type==='notify-templates'?'notify-template':'notify-message')+':'+action)
const tabs=computed(()=>(['notify-templates','notify-messages'] as const).filter(type=>can(type,'query')))
const rows=ref<Row[]>([]), detail=ref<Row>(), editor=ref<Template>()
const page=ref(1), total=ref(0), search=ref(''), applied=ref('')
const busy=ref(false), error=ref(''), notice=ref('')
const recipient=ref(''), params=ref<Record<string,string>>({})
const names=computed(()=>[...new Set([...String(detail.value?.content??'').matchAll(/\{(.*?)}/g)].map(match=>match[1]))])
const sendKey=()=>['yc-notify-pending',session.value?.tenantId,identity.value?.user.id,detail.value?.id].join(':')
const pending=ref(false)
const sendable=computed(()=>kind.value==='notify-templates'&&Number(detail.value?.status)===0&&can(kind.value,'send-notify'))
const title=(type:Kind)=>type==='notify-templates'?'通知模板':'发送记录'
const logLabels:Record<string,string>={id:'发送记录编号',userId:'接收账号',templateId:'模板编号',templateCode:'模板编码',templateNickname:'发送人',templateType:'类型',readStatus:'已读',readTime:'已读时间',createTime:'发送时间'}
async function perform(operation:()=>Promise<void>){
  if(!current()||busy.value)return
  busy.value=true;error.value=''
  try{await operation()}
  catch(failure){if(current()&&failure!=='cancel'&&failure!=='close')error.value=(failure as Error).message}
  finally{if(current())busy.value=false}
}
async function load(next:number, keyword=applied.value){
  if(!can(kind.value,'query'))return
  const result=await request<{list:Row[];total:number}>(base+kind.value+'/page',{data:{keyword,pageNo:next,pageSize:20}})
  if(!current())return
  if(!Array.isArray(result?.list)||!Number.isSafeInteger(result.total)||result.total<0)throw Error('列表回执不完整')
  rows.value=result.list;total.value=result.total;page.value=next;applied.value=keyword
}
function select(type:Kind){
  return perform(async()=>{
    kind.value=type;search.value='';applied.value='';rows.value=[];total.value=0;page.value=1
    detail.value=undefined;editor.value=undefined;notice.value=''
    await load(1)
  })
}
async function read(id:string){
  const result=await request<Row>(base+kind.value+'/get',{data:{id}})
  if(!current())return
  detail.value=result;editor.value=undefined;recipient.value='';params.value={}
  pending.value=kind.value==='notify-templates'&&localStorage.getItem(sendKey())!==null
}
function edit(original?:Row){
  if(!can(kind.value,original?'update':'create'))return
  if(!original)detail.value=undefined
  editor.value={
    name:String(original?.name??''),code:String(original?.code??''),nickname:String(original?.nickname??''),
    type:String(original?.type??'1'),content:String(original?.content??''),status:Number(original?.status??0),
    remark:String(original?.remark??''),
  }
}
function save(){
  return perform(async()=>{
    const draft=editor.value, original=detail.value
    if(!draft||!can(kind.value,original?'update':'create'))return
    if(!draft.name.trim()||!draft.code.trim()||!draft.nickname.trim()||!draft.content.trim()||!/^\d{1,9}$/.test(draft.type))throw Error('请填写名称、编码、发送人、类型和正文')
    const values={...draft,name:draft.name.trim(),code:draft.code.trim(),nickname:draft.nickname.trim(),type:Number(draft.type)}
    await showConfirmDialog({title:'保存通知模板',message:values.name})
    if(!current())return
    const id=identityId(await request(base+kind.value+'/save',{method:'POST',data:{id:original?.id,revision:original?.revision,values}}))
    if(!current())return
    notice.value='通知模板已保存';editor.value=undefined
    await read(id)
    await load(page.value)
  })
}
function send(){
  return perform(async()=>{
    const item=detail.value
    if(!item||!sendable.value||pending.value)return
    const receiver=identityId(recipient.value.trim())
    const body=String(item.content??'')
    const templateParams:Record<string,string>=Object.create(null)
    for(const name of names.value){
      const value=params.value[name]
      if(typeof value!=='string'||!value.trim())throw Error('请填写模板参数 '+name)
      templateParams[name]=value
    }
    const preview=body.replace(/\{(.*?)}/g,(_,name)=>templateParams[name]??'')
    await showConfirmDialog({title:'确认发送站内通知',message:'接收账号 '+receiver+'\n'+preview})
    if(!current())return
    const storage=sendKey()
    if(localStorage.getItem(storage)!==null)throw Error('已有发送请求待核对')
    const requestKey=crypto.randomUUID()
    localStorage.setItem(storage,requestKey)
    pending.value=true
    const response=await request(base+'notify-templates/send',{method:'POST',data:{id:item.id,revision:item.revision,recipient:receiver,userType:2,templateParams,requestKey}})
    if(!current())return
    const id=identityId(response)
    if(localStorage.getItem(storage)===requestKey)localStorage.removeItem(storage)
    pending.value=false
    notice.value='发送记录 '+id+' 已生成'
    recipient.value='';params.value={}
  })
}
function acknowledge(){
  return perform(async()=>{
    await showConfirmDialog({title:'确认已人工核对',message:'请先在发送记录中核对原请求。清除提醒后可以发起新的发送。'})
    if(!current())return
    localStorage.removeItem(sendKey())
    pending.value=false
  })
}
onMounted(async()=>{
  await perform(async()=>{if(!identity.value)await loadAccount()})
  if(tabs.value[0])await select(tabs.value[0])
})
</script>

<template>
  <div class="page-title"><h1>站内通知管理</h1></div>
  <p v-if="error" class="card error" role="alert">{{ error }}</p>
  <p v-if="notice" class="card success" role="status">{{ notice }}</p>
  <p v-if="!busy && !tabs.length" class="card">当前账号没有站内通知管理权限。</p>
  <template v-if="tabs.length">
    <section class="card">
      <van-button v-for="tab in tabs" :key="tab" :type="kind===tab?'primary':'default'" :disabled="busy" @click="select(tab)">{{ title(tab) }}</van-button>
      <form @submit.prevent="perform(() => load(1,search.trim()))">
        <van-field v-model="search" :label="kind==='notify-templates'?'模板名称':'模板编码'" maxlength="100" :disabled="busy"/>
        <van-button native-type="submit" :disabled="busy">查询</van-button>
        <van-button v-if="kind==='notify-templates' && can(kind,'create')" type="primary" :disabled="busy" @click="edit()">新增通知模板</van-button>
      </form>
      <van-empty v-if="!busy && !rows.length" description="暂无记录"/>
      <article v-for="row in rows" :key="String(row.id)" class="notify-row">
        <strong>{{ row.name || row.templateCode }}</strong> · {{ row.code || row.userId }}
        <van-button size="small" :disabled="busy" @click="perform(() => read(identityId(row.id)))">查看</van-button>
      </article>
      <van-button size="small" :disabled="busy || page<=1" @click="perform(() => load(page-1))">上一页</van-button>
      <span> 第 {{ page }} 页 / 共 {{ total }} 条 </span>
      <van-button size="small" :disabled="busy || page*20>=total" @click="perform(() => load(page+1))">下一页</van-button>
    </section>
    <section v-if="detail && !editor" class="card">
      <h2>{{ kind==='notify-templates'?'模板详情':'发送详情' }}</h2>
      <template v-if="kind==='notify-templates'">
        <p>{{ detail.name }} · {{ detail.code }} · {{ Number(detail.status)===0?'启用':'停用' }}</p>
        <p class="notify-content">{{ detail.content }}</p>
        <van-button v-if="can(kind,'update')" :disabled="busy" @click="edit(detail)">编辑模板</van-button>
        <p v-if="pending">该模板有发送结果待核对，请先查看发送记录。</p>
        <van-button v-if="pending && can('notify-messages','query')" :disabled="busy" @click="acknowledge">已核对发送记录</van-button>
        <form v-if="sendable && !pending" @submit.prevent="send">
          <van-field v-model="recipient" label="接收账号编号" inputmode="numeric" maxlength="19" :disabled="busy"/>
          <van-field v-for="name in names" :key="name" v-model="params[name]" :label="name" maxlength="1000" :disabled="busy"/>
          <van-button native-type="submit" :disabled="busy">预览并发送</van-button>
        </form>
      </template>
      <dl v-else><div v-for="(label,key) in logLabels" :key="key"><dt>{{ label }}</dt><dd>{{ detail[key] ?? '—' }}</dd></div></dl>
    </section>
    <form v-if="editor" class="card" @submit.prevent="save">
      <h2>{{ detail?'编辑通知模板':'新增通知模板' }}</h2>
      <van-field v-model="editor.name" label="名称" maxlength="100" :disabled="busy"/>
      <van-field v-model="editor.code" label="编码" maxlength="100" :disabled="busy"/>
      <van-field v-model="editor.nickname" label="发送人" maxlength="100" :disabled="busy"/>
      <van-field v-model="editor.type" label="类型编号" inputmode="numeric" :disabled="busy"/>
      <van-field v-model="editor.content" label="正文" placeholder="可用 {参数名} 插入变量" type="textarea" :disabled="busy"/>
      <van-field v-model="editor.remark" label="备注" :disabled="busy"/>
      <label>状态<select v-model="editor.status" :disabled="busy"><option :value="0">启用</option><option :value="1">停用</option></select></label>
      <van-button type="primary" native-type="submit" :disabled="busy">保存模板</van-button>
      <van-button :disabled="busy" @click="editor=undefined">取消</van-button>
    </form>
  </template>
</template>

<style scoped>
.notify-row { padding: 12px 0; border-bottom: 1px solid #dce4ef; }
.notify-content { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
