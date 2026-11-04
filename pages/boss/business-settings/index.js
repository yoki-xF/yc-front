const api=require('../../../utils/boss/api')
const settings=require('../../../utils/boss/business-settings')
Page({
  data:{loading:true,busy:false,error:'',notice:'',record:null,fields:[],reason:'',needsReload:false},
  onLoad(){this.session=wx.getStorageSync('yc_session');this.version=0;this.load()},
  onShow(){if(this.opened&&!this.current()){this.version++;this.original=null;this.setData({record:null,fields:[],loading:false,busy:false,error:'账号已变化，请返回重新进入'})}this.opened=true},
  onUnload(){this.disposed=true;this.version++;this.original=null},
  current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(_){return false}},
  async load(){
    if(!this.current())return
    const version=++this.version;this.setData({loading:true,error:'',record:null})
    try{const record=await settings.get(this.session);if(version!==this.version||!this.current())return;this.original=record;this.setData({record:{canSave:record.canSave,locked:record.locked,reason:record.reason},fields:settings.fields.map(f=>({...f,checked:record.values[f.key]})),reason:'',needsReload:false})}
    catch(error){if(version===this.version&&this.current())this.setData({error:error.message||'读取失败'})}
    finally{if(version===this.version&&this.current())this.setData({loading:false})}
  },
  change(e){if(this.data.loading||this.data.busy||this.data.needsReload||!this.data.record||!this.data.record.canSave||!this.current())return;const key=e.currentTarget.dataset.key;if(!settings.fields.some(f=>f.key===key)||typeof e.detail.value!=='boolean')return;this.setData({fields:this.data.fields.map(f=>f.key===key?{...f,checked:e.detail.value}:f),notice:''})},
  reason(e){if(!this.data.busy&&!this.data.needsReload&&this.current())this.setData({reason:e.detail.value})},
  async submit(){
    if(this.data.loading||this.data.busy||this.data.needsReload||!this.current())return
    const original=this.original,values=Object.fromEntries(this.data.fields.map(f=>[f.key,f.checked])),reason=this.data.reason
    try{settings.payload(original,values,reason)}catch(error){this.setData({error:error.message});return}
    this.setData({busy:true,error:'',notice:''})
    const approved=await new Promise(resolve=>wx.showModal({title:'确认经营设置',content:'设置影响本组织所有门店。开始营业后将锁定，不能直接切换，请核对后保存。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
    if(!approved||!this.current()){if(this.current())this.setData({busy:false});return}
    try{await settings.save(this.session,original,values,reason);if(this.current()){this.setData({notice:'经营设置已保存。'});await this.load()}}
    catch(error){if(this.current())this.setData({needsReload:true,error:error.mayHaveWritten?'保存结果尚未确认。请重新读取核对，不要重复提交。':(error.message||'保存失败')+'。输入已保留，请重新读取后核对。'})}
    finally{if(this.current())this.setData({busy:false})}
  },
  async retry(){
    if(this.data.loading||this.data.busy||!this.current())return
    if(this.data.record){const approved=await new Promise(resolve=>wx.showModal({title:'重新读取设置',content:'将以服务器设置替换当前未保存的输入。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}));if(!approved||!this.current())return}
    this.load()
  }
})
