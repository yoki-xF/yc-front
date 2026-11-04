const operatingDay = require('../../utils/operating-day')
const { request,sameSession }=require('../../utils/request')
const headers=s=>({Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)})
function cents(v){const s=String(v==null?'':v);if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(s))return null;const p=s.split('.');return Number(p[0])*100+Number((p[1]||'').padEnd(2,'0'))}
function quantity(v){return /^\d{1,7}$/.test(String(v)) && Number(v)<=1000000 ? Number(v) : null}
function total(items){let result=0;for(const item of items){const price=cents(item.price),money=cents(item.money),pack=quantity(item.packages),sheets=quantity(item.sheets);if([price,money,pack,sheets].some(x=>x===null)||(pack===0&&sheets===0))return null;result+=price*pack+money*sheets;if(!Number.isSafeInteger(result))return null}return result}
Page({
 data:{loading:true,busy:false,error:'',notice:'',uncertain:false,conflict:false,saved:false,editMode:false,materials:[],items:[],remark:'',total:'—'},
 onLoad(o){
  this.session=wx.getStorageSync('yc_session');this.deptId=String(o.deptId || '');this.userId=String(o.userId || '');this.id=o.id ? Number(o.id) : null
  this.setData({deptName:o.deptName?decodeURIComponent(o.deptName):'',editMode:!!this.id})
  if(!this.session || !this.deptId || !this.userId || (o.id && !this.id)){this.setData({loading:false,error:'登录或单据信息已失效，请返回重新进入'});return}
  if(this.id && wx.setNavigationBarTitle)wx.setNavigationBarTitle({title:'编辑订票单'})
  this.load(false)
 },
 onUnload(){this.destroyed=true},
 current(){return !this.destroyed && (!this.operatingDay || (String(this.deptId) === this.operatingDay.deptId && String(this.userId) === this.operatingDay.userId)) && sameSession(this.session,wx.getStorageSync('yc_session'))},
 save(){if(this.current())wx.setStorageSync(this.draftKey,{items:this.data.items,remark:this.data.remark,uncertain:this.data.uncertain,revision:this.revision})},
 calculate(){const n=this.data.items.length?total(this.data.items):null;this.setData({total:n===null?'—':(n/100).toFixed(2)})},
 async load(discardDraft){
  if(!this.current()){this.setData({loading:false,error:'账号已切换，请返回重新进入'});return}
  this.setData({loading:true,error:''})
  try{
   await operatingDay.bind(this, 'yc_purchase', [this.id||'new'])
   const session=wx.getStorageSync('yc_session');const requests=[request('/sport/wx/common/material/List',{header:operatingDay.header(this,headers(session))})]
   if(this.id)requests.push(request('/sport/wx/order-ledger/detail',{data:{deptId:this.deptId,type:'purchase',id:this.id},header:operatingDay.header(this,headers(session))}))
   const result=await Promise.all(requests);if(!this.current())return
   const materials=result[0],detail=result[1];if(!Array.isArray(materials))throw Error('票种数据不完整')
   const currentDraft = !discardDraft && wx.getStorageSync(this.draftKey)
   const legacyDraft = null
   let draft = currentDraft || legacyDraft
   this.usedLegacyDraft = !!legacyDraft
   if(this.id){
    if(!detail || !detail.order || !Array.isArray(detail.items) || !detail.revision)throw Error('单据数据不完整，请重试')
    if(detail.order.stat!==0)throw Error('单据不再处于待确认状态，草稿仍保存在本机，请返回详情核对。')
    const fresh=detail.items.map(x=>({id:x.materialId,name:x.materialName,money:x.money,price:x.price,packages:String(x.packageNum==null?'':x.packageNum),sheets:String(x.sheetNum==null?'':x.sheetNum)}))
    const conflict=!!(draft && draft.revision!==detail.revision)
    this.revision=draft ? draft.revision : detail.revision
    this.setData({materials,items:draft&&Array.isArray(draft.items)?draft.items:fresh,remark:draft?(draft.remark||''):((detail.items[0]&&detail.items[0].remark)||''),uncertain:!!(draft&&draft.uncertain),conflict,notice:conflict?'单据已变化，本机草稿已保留。请核对后选择是否加载最新单据。':draft?'已恢复本机草稿，请核对后提交。':''})
   }else{
    this.setData({materials,items:draft&&Array.isArray(draft.items)?draft.items:[],remark:draft?(draft.remark||''):'',uncertain:!!(draft&&draft.uncertain),conflict:false,notice:draft?'已恢复本机草稿，请核对后提交。':''})
    if(draft && !wx.getStorageSync(this.draftKey))this.save()
   }
   if(discardDraft)wx.removeStorageSync(this.draftKey)
   this.calculate()
  }catch(e){if(this.current())this.setData({error:e.message||'加载失败'})}
  finally{if(this.current())this.setData({loading:false})}
 },
 retry(){if(!this.data.loading&&!this.data.busy)this.load(false)},
 reloadLatest(){if(!this.id||this.data.busy||this.data.loading)return;wx.showModal({title:'加载最新单据',content:'加载最新单据会放弃本机编辑草稿，是否继续？',success:r=>{if(r.confirm&&this.current())this.load(true)}})},
 back(){wx.navigateBack()},
 add(e){if(this.data.busy||this.data.saved)return;const item=this.data.materials[Number(e.detail.value)];if(!item||this.data.items.some(x=>String(x.id)===String(item.id)))return wx.showToast({title:'该票种已添加',icon:'none'});this.setData({items:this.data.items.concat([{id:item.id,name:item.materialName,money:item.money,price:item.price,packages:'0',sheets:'0'}])});this.calculate();this.save()},
 input(e){if(this.data.busy||this.data.saved)return;const index=Number(e.currentTarget.dataset.index),field=e.currentTarget.dataset.field;if(!this.data.items[index]||!['packages','sheets'].includes(field))return;this.setData({['items['+index+'].'+field]:e.detail.value});this.calculate();this.save()},
 remark(e){if(this.data.busy||this.data.saved)return;this.setData({remark:e.detail.value});this.save()},
 remove(e){if(this.data.busy||this.data.saved)return;const items=this.data.items.slice();items.splice(Number(e.currentTarget.dataset.index),1);this.setData({items});this.calculate();this.save()},
 async submit(){
  if(this.data.busy||this.data.uncertain||this.data.conflict||this.data.saved||this.data.loading||!this.current())return
  if(!this.data.items.length||this.data.total==='—'){this.setData({error:'请添加票种并填写有效数量，每个票种至少一包或一张。'});return}
  if(this.data.remark.length>255){this.setData({error:'备注不能超过 255 字。'});return}
  if(this.data.items.some(x=>{const current=this.data.materials.find(m=>String(m.id)===String(x.id));return !current || cents(current.price)!==cents(x.price) || cents(current.money)!==cents(x.money)})){this.setData({error:'票种或价格已变化，请移除对应票种后重新添加。'});return}
  const edit=!!this.id;const confirmed=await new Promise(resolve=>wx.showModal({title:edit?'保存订票单':'创建订票单',content:edit?'保存会更新待确认单据，当前不会增加库存。':'创建待确认订票单，当前不会增加库存。单据金额以提交时的票种价格为准。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
  if(!confirmed||this.data.busy||!this.current())return
  const data={deptId:this.deptId,remark:this.data.remark,items:this.data.items.map(x=>({materialId:x.id,packageNum:quantity(x.packages),sheetNum:quantity(x.sheets),expectedMoney:x.money,expectedPrice:x.price}))}
  if(edit){data.id=this.id;data.revision=this.revision}
  this.setData({busy:true,error:'',notice:''})
  try{
   const result=await request('/sport/wx/order-ledger/purchase/'+(edit?'edit':'create'),{method:'POST',data,header:operatingDay.header(this,headers(wx.getStorageSync('yc_session')))})
   if(!this.current())return
   if(!result)throw Error('未取得保存结果')
   wx.removeStorageSync(this.draftKey);
   if(edit)this.setData({saved:true,notice:'修改已保存，请返回详情核对。'})
   else this.setData({items:[],remark:'',total:'—',notice:'订票单已创建，请返回单据列表核对。'})
   wx.showToast({title:edit?'保存成功':'创建成功',icon:'success'})
  }catch(e){if(this.current()){
   if([10086,403,401].includes(e.code))this.setData({error:e.message||'保存失败，请核对后重试。'})
   else{this.setData({uncertain:true,error:edit?'保存结果未确认，请返回详情核对，避免重复提交。':'创建结果未确认，请先返回订票列表核对，避免重复创建。'});this.save()}
  }}finally{if(this.current())this.setData({busy:false})}
 },
 confirmChecked(){wx.showModal({title:'核对保存结果',content:this.id?'请先返回详情核对单据。确认已核对后，才可再次提交。':'请先查看订票列表并核对是否已创建。确认核对后，才可再次提交。',success:r=>{if(r.confirm&&this.current()){this.setData({uncertain:false,error:'',notice:'请核对内容后提交。'});this.save()}}})}
})
