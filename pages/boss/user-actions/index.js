const api=require('../../../utils/boss/api')
const actions=require('../../../utils/boss/user-actions')
Page({
 data:{loading:true,busy:false,error:'',notice:'',record:null,rolesEmpty:true,roles:[],roleIds:[],password:'',confirmation:'',uncertain:false},
 onLoad(o){this.session=wx.getStorageSync('yc_session');this.id=o.id;this.version=0;this.load()},
 onHide(){this.setData({password:'',confirmation:''})},
 onUnload(){this.disposed=true;this.version++;this.original=null;this.setData({record:null,rolesEmpty:true,roles:[],roleIds:[],password:'',confirmation:''})},
 onShow(){if(this.opened&&!this.current()){this.version++;this.original=null;this.setData({loading:false,busy:false,record:null,rolesEmpty:true,roles:[],roleIds:[],password:'',confirmation:'',error:'账号已变化，请返回重新进入'})}this.opened=true},
 current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(_){return false}},
 async load(){const version=++this.version;this.setData({loading:true,error:'',record:null,password:'',confirmation:''});try{const record=await actions.get(this.session,this.id);if(version!==this.version)return;this.original=record;this.setData({uncertain:false,record:{id:record.id,username:record.username,nickname:record.nickname,status:record.status,canStatus:record.canStatus,canReset:record.canReset,canAssign:record.canAssign},roleIds:record.roleIds.map(String),rolesEmpty:record.roles.length===0,roles:record.roles.map(r=>({...r,checked:record.roleIds.map(String).includes(String(r.id))}))})}catch(e){if(version===this.version)this.setData({error:e.message||'读取失败'})}finally{if(version===this.version)this.setData({loading:false})}},
 input(e){if(this.data.busy||this.data.uncertain||!this.current())return;const key=e.currentTarget.dataset.key;if(['password','confirmation'].includes(key))this.setData({[key]:e.detail.value})},
 roles(e){if(!this.data.busy&&!this.data.uncertain&&this.current())this.setData({roleIds:e.detail.value})},
 async submit(e){
  if(this.data.busy||this.data.loading||this.data.uncertain||!this.data.record||!this.current())return
  const action=e.currentTarget.dataset.action,values={status:Number(this.data.record.status)===0?1:0,password:this.data.password,confirmation:this.data.confirmation,roleIds:[...this.data.roleIds]}
  try{actions.payload(action,this.original,values)}catch(error){this.setData({error:error.message});return}
  const description=action==='status'?(values.status===1?'将阻止该账号后续登录。已有登录会话需另行核对退出。':'将重新启用该账号。'):action==='password'?'将为该账号设置新密码，请通过安全方式告知账号持有人。':'将调整该账号的角色。取消全部角色会移除相应功能权限。'
  this.setData({busy:true,error:'',notice:''})
  const approved=await new Promise(resolve=>wx.showModal({title:'确认操作：'+this.data.record.username,content:description,success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
  if(!approved||!this.current()){delete values.password;delete values.confirmation;if(this.current())this.setData({busy:false});return}
  try{await actions.save(this.session,action,this.original,values);if(!this.current())return;this.setData({notice:action==='password'?'密码已重置，请告知账号持有人。':'操作已完成。',password:'',confirmation:''});await this.load()}
  catch(error){if(this.current())this.setData({uncertain:!!error.mayHaveWritten,password:'',confirmation:'',error:error.mayHaveWritten?'操作结果尚未确认。请先重新读取账号信息；密码结果需核对登录或联系管理员，不要直接重复提交。':error.message||'操作失败'})}
  finally{delete values.password;delete values.confirmation;if(this.current())this.setData({busy:false})}
 },
 retry(){if(!this.data.busy&&!this.data.loading)this.load()}
})
