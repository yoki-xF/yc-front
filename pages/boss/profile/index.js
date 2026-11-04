const api=require('../../../utils/boss/api')
const {profilePayload,passwordPayload}=require('../../../utils/boss/profile')
const emptyPasswords=()=>({oldPassword:'',newPassword:'',confirmation:''})
Page({
  data:{loading:true,busy:false,error:'',notice:'',profile:null,values:{},passwords:emptyPasswords(),passwordMode:false,uncertain:false},
  onLoad(){this.session=wx.getStorageSync('yc_session');this.version=0;this.load()},
  onShow(){if(this.opened&&!this.current()){this.version++;this.setData({loading:false,busy:false,profile:null,values:{},passwords:emptyPasswords(),error:'账号已变化，请返回重新进入'})}this.opened=true},
  onHide(){this.setData({passwords:emptyPasswords()})},
  onUnload(){this.disposed=true;this.version++;this.original=null;this.setData({passwords:emptyPasswords(),profile:null,values:{}})},
  current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(_){return false}},
  async load(){
    const version=++this.version;this.setData({loading:true,error:'',notice:'',profile:null,values:{},passwords:emptyPasswords()})
    try{
      const result=await api.profile(this.session);if(version!==this.version)return
      this.original=result
      this.setData({uncertain:false,profile:{avatar:result.avatar||'',username:result.username||'—',department:result.dept&&result.dept.name||'未设置',roles:(result.roles||[]).map(r=>r.name).join('、')||'未设置'},values:{nickname:result.nickname||'',mobile:result.mobile||'',email:result.email||''}})
    }catch(e){if(version===this.version)this.setData({error:e.message||'读取失败'})}
    finally{if(version===this.version)this.setData({loading:false})}
  },
  async avatar(){
    if(this.data.busy||this.data.loading||this.data.uncertain||!this.data.profile||!this.current())return
    this.setData({busy:true,error:'',notice:''})
    try{
      const avatar=require('../../../utils/boss/avatar')
      const path=await avatar.choose();if(!path||!this.current())return
      const url=await avatar.upload(this.session,path);if(!this.current())return
      this.original={...this.original,avatar:url};this.setData({'profile.avatar':url,notice:'头像已更新。'})
    }catch(e){if(this.current())this.setData({uncertain:!!e.mayHaveWritten,error:e.message||'头像更新失败'})}
    finally{if(this.current())this.setData({busy:false})}
  },
  retry(){if(!this.data.busy&&!this.data.loading)this.load()},
  mode(e){if(this.data.busy||!this.current())return;this.setData({passwordMode:e.currentTarget.dataset.mode==='password',passwords:emptyPasswords(),error:'',notice:''})},
  input(e){
    if(this.data.busy||this.data.uncertain||!this.current())return
    const key=e.currentTarget.dataset.key
    if(['nickname','email','mobile'].includes(key))this.setData({['values.'+key]:e.detail.value})
    else if(['oldPassword','newPassword','confirmation'].includes(key))this.setData({['passwords.'+key]:e.detail.value})
  },
  async submit(){
    if(this.data.busy||this.data.loading||this.data.uncertain||!this.data.profile||!this.current())return
    const password=this.data.passwordMode
    // Freeze exactly the values the user reviews in the confirmation dialog.
    const values={...(password?this.data.passwords:this.data.values)}
    try{password?passwordPayload(values):profilePayload(values,this.original)}catch(e){this.setData({error:e.message});return}
    this.setData({busy:true,error:'',notice:''})
    const approved=await new Promise(resolve=>wx.showModal({title:password?'确认修改密码':'确认保存资料',content:password?'将修改当前登录账号的密码。':'将更新当前登录账号的姓名和联系方式。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
    if(!approved||!this.current()){if(this.current())this.setData({busy:false});return}
    try{
      await api.saveProfile(this.session,values,this.original,password)
      if(!this.current())return
      if(!password)this.original={...this.original,...profilePayload(values,this.original)}
      this.setData({notice:password?'密码已修改。':'个人资料已保存。',passwords:emptyPasswords()})
    }catch(e){if(this.current())this.setData({uncertain:!!e.mayHaveWritten,passwords:emptyPasswords(),error:e.mayHaveWritten?(password?'修改结果尚未确认，请先核对登录情况或联系管理员，不要重复提交。':'保存结果尚未确认，请重新读取资料核对。'):e.message||'保存失败'})}
    finally{for(const key of ['oldPassword','newPassword','confirmation'])delete values[key];if(this.current())this.setData({busy:false})}
  }
})
