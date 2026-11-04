const api=require('../../../utils/boss/api')
const opening=require('../../../utils/boss/opening')
const emptyFunds=()=>Object.fromEntries(opening.fundFields.map(f=>[f.key,'0.00']))
Page({
  data:{loading:true,busy:false,error:'',notice:'',departments:[],deptIndex:-1,materials:[],fundFields:opening.fundFields,funds:emptyFunds(),reason:'',status:null,pending:false},
  onLoad(){this.session=wx.getStorageSync('yc_session');this.version=0;this.load()},
  onShow(){if(this.opened&&!this.current()){this.version++;this.setData({funds:emptyFunds(),materials:[],departments:[],status:null,error:'账号已变化，请返回重新进入'})}this.opened=true},
  onUnload(){this.disposed=true;this.version++;this.pendingBody=null;this.setData({funds:emptyFunds(),materials:[],reason:''})},
  current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(e){return false}},
  async load(){
    if(this.data.busy)return
    const version=++this.version,loadVersion=this.loadVersion=(this.loadVersion||0)+1;this.setData({loading:true,error:'',status:null})
    try{const info=await api.identity(this.session);if(!this.current()||version!==this.version)return;this.actor=String(info.user.id);this.pendingKey='yc_boss_opening_'+this.session.tenantId+'_'+this.actor;const result=await opening.options(this.session);if(!this.current()||version!==this.version)return
      const pending=wx.getStorageSync(this.pendingKey);this.pendingBody=pending&&pending.deptId&&pending.requestKey?pending:null
      this.setData({departments:result.departments,deptIndex:-1,materials:result.materials.map(m=>({...m,selected:false,packageNum:'0',sheetNum:'0'})),pending:!!this.pendingBody,funds:emptyFunds(),reason:''})
      if(this.pendingBody){const i=result.departments.findIndex(d=>String(d.id)===String(this.pendingBody.deptId));if(i>=0){this.setData({deptIndex:i});await this.verify()}}
    }catch(e){if(this.current()&&version===this.version)this.setData({error:e.message||'读取失败'})}
    finally{if(this.current()&&loadVersion===this.loadVersion)this.setData({loading:false})}
  },
  async reload(){if(this.data.busy||this.data.pending||!this.current())return;const yes=await new Promise(resolve=>wx.showModal({title:'重新读取选项',content:'将清空尚未提交的资金和库存输入，并读取最新票种资料。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}));if(yes&&this.current())this.load()},
  async department(e){if(this.data.busy||this.data.pending||!this.current())return;const i=Number(e.detail.value);if(!this.data.departments[i])return;this.setData({deptIndex:i,status:null,error:'',notice:'',funds:emptyFunds(),reason:'',materials:this.data.materials.map(m=>({...m,selected:false,packageNum:'0',sheetNum:'0'}))});await this.verify()},
  async verify(){
    if(this.data.busy||!this.current())return
    const dept=this.data.departments[this.data.deptIndex];if(!dept)return
    const version=++this.version;this.setData({busy:true,error:'',status:null})
    try{const status=await opening.status(this.session,dept.id);if(!this.current()||version!==this.version)return;this.setData({status});if(status.initialized){wx.removeStorageSync(this.pendingKey);this.pendingBody=null;this.setData({pending:false,notice:'门店已初始化，请核对初始记录，不能再次覆盖。'})}}
    catch(e){if(this.current()&&version===this.version)this.setData({error:e.message||'读取状态失败'})}
    finally{if(this.current()&&version===this.version)this.setData({busy:false})}
  },
  editable(){return this.current()&&!this.data.busy&&!this.data.pending&&this.data.status&&this.data.status.canInitialize},
  input(e){if(!this.editable())return;const key=e.currentTarget.dataset.key;if(key==='reason')this.setData({reason:e.detail.value});else if(opening.fundFields.some(f=>f.key===key))this.setData({['funds.'+key]:e.detail.value})},
  select(e){if(!this.editable())return;const ids=e.detail.value.map(String);this.setData({materials:this.data.materials.map(m=>({...m,selected:ids.includes(String(m.id))}))})},
  count(e){if(!this.editable())return;const i=Number(e.currentTarget.dataset.index),key=e.currentTarget.dataset.key;if(this.data.materials[i]&&['packageNum','sheetNum'].includes(key))this.setData({['materials['+i+'].'+key]:e.detail.value})},
  async submit(){
    if(!this.editable())return
    let body;try{body=opening.payload(this.data.departments[this.data.deptIndex].id,this.data.funds,this.data.materials,this.data.reason,'opening-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+this.actor)}catch(e){this.setData({error:e.message});return}
    this.setData({busy:true,error:''})
    const summary=opening.fundFields.map(f=>f.label+'：'+body.funds[f.key]+'元').join('\n')+'\n票种：'+body.lines.length+'种\n仅首次启用，不能重复覆盖。'
    const approved=await new Promise(resolve=>wx.showModal({title:'确认门店初始资金与库存',content:summary,success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
    if(!approved||!this.current()){if(this.current())this.setData({busy:false});return}
    try{wx.setStorageSync(this.pendingKey,body)}catch(e){this.setData({busy:false,error:'无法保存请求标识，请检查设备存储后重试；尚未提交初始化。'});return}
    this.pendingBody=body;this.setData({pending:true});await this.write(body)
  },
  async retryPending(){if(this.data.busy||!this.pendingBody||!this.current())return;this.setData({busy:true,error:''});await this.write(this.pendingBody)},
  async write(body){
    try{await opening.apply(this.session,body);if(!this.current())return;wx.removeStorageSync(this.pendingKey);this.pendingBody=null;this.setData({pending:false,status:{initialized:true,canInitialize:false,reason:'门店已完成首次初始化。'},notice:'初始化完成，请进入员工端核对早盘数据。'})}
    catch(e){if(this.current()){if(!e.mayHaveWritten){wx.removeStorageSync(this.pendingKey);this.pendingBody=null;this.setData({pending:false})}this.setData({error:e.mayHaveWritten?'提交结果未确认，请先核对状态；如需重试会沿用同一请求，避免重复记账。':e.message||'初始化失败'})}}
    finally{if(this.current())this.setData({busy:false})}
  }
})
