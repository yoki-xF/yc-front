const api=require('../../../utils/boss/api')
const day=require('../../../utils/boss/operating-day')
Page({
  data:{loading:true,busy:false,error:'',notice:'',departments:[],deptIndex:-1,status:null,preview:null,pending:false,canOpen:false,canClose:false},
  onLoad(){this.session=wx.getStorageSync('yc_session');this.version=0;this.load()},
  onShow(){if(this.opened&&!this.current()){this.version++;this.setData({status:null,preview:null,departments:[],error:'账号已变化，请返回重新进入'})}this.opened=true},
  onUnload(){this.disposed=true;this.version++;this.pendingBody=null},
  current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(e){return false}},
  async load(){
    const version=++this.version;this.setData({loading:true,error:''})
    try{
      const access=await day.permissions(this.session);if(!this.current()||version!==this.version)return
      if(!access.query)throw Error('当前账号没有营业日查看权限，请联系管理员')
      const departments=await api.options(this.session);if(!this.current()||version!==this.version)return
      this.pendingKey='yc_business_day_'+this.session.tenantId+'_'+access.actor
      const pending=wx.getStorageSync(this.pendingKey)
      this.pendingBody=pending&&['open','close'].includes(pending.action)&&pending.data&&pending.data.deptId&&pending.data.requestKey?pending:null
      const deptIndex=this.pendingBody?departments.findIndex(d=>String(d.id)===String(this.pendingBody.data.deptId)):-1
      this.setData({departments,deptIndex,pending:!!this.pendingBody,canOpen:access.open,canClose:access.close})
      if(deptIndex>=0)await this.refresh()
    }catch(e){if(this.current()&&version===this.version)this.setData({error:e.message||'读取失败'})}
    finally{if(this.current())this.setData({loading:false})}
  },
  async department(e){if(this.data.busy||this.data.pending||!this.current())return;const index=Number(e.detail.value);if(!this.data.departments[index])return;this.version++;this.setData({deptIndex:index,status:null,preview:null,notice:'',error:''});await this.refresh()},
  async refresh(){
    if(this.data.busy||!this.current())return
    const dept=this.data.departments[this.data.deptIndex];if(!dept)return
    const version=++this.version;this.setData({busy:true,error:'',preview:null,status:null})
    try{const status=await day.current(this.session,dept.id);if(this.current()&&version===this.version)this.setData({status})}
    catch(e){if(this.current()&&version===this.version)this.setData({error:e.message||'读取状态失败'})}
    finally{if(this.current()&&version===this.version)this.setData({busy:false})}
  },
  async preview(){
    if(this.data.busy||this.data.pending||!this.data.canClose||!this.current()||!this.data.status||this.data.status.status!=='OPEN')return
    const version=++this.version,dept=this.data.departments[this.data.deptIndex];this.setData({busy:true,error:'',preview:null})
    try{const preview=await day.preview(this.session,dept.id);if(this.current()&&version===this.version){if(preview.id!==this.data.status.id)throw Error('营业日已变化，请重新读取状态');this.setData({preview})}}
    catch(e){if(this.current()&&version===this.version)this.setData({error:e.message||'无法结店，请核对盘点和待确认单据'})}
    finally{if(this.current()&&version===this.version)this.setData({busy:false})}
  },
  open(){return this.submit('open')},
  close(){return this.submit('close')},
  async submit(action){
    if(this.data.busy||this.data.pending||!this.current()||!this.data.status)return
    if(action==='open'&&(!this.data.canOpen||this.data.status.status!=='NOT_OPEN'))return
    if(action==='close'&&(!this.data.canClose||!this.data.preview))return
    const dept=this.data.departments[this.data.deptIndex];let body
    try{body=day.command(action,dept.id,'day-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2),this.data.preview)}catch(e){this.setData({error:e.message});return}
    this.setData({busy:true,error:''})
    const content=action==='open'?'为“'+dept.name+'”开启营业日。跨午夜仍归开店当天，完成全部盘点后再结店。':'营业日：'+this.data.preview.businessDate+'\n总销量：'+this.data.preview.report.totalSales+'元\n资金账差：'+this.data.preview.report.variance+'元\n确认后停止当日普通记账，后续更正需留痕。'
    const approved=await new Promise(resolve=>wx.showModal({title:action==='open'?'确认开店':'确认结店',content,success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
    if(!approved||!this.current()){if(this.current())this.setData({busy:false});return}
    try{wx.setStorageSync(this.pendingKey,body)}catch(e){this.setData({busy:false,error:'无法保存请求标识，尚未提交，请检查设备存储。'});return}
    this.pendingBody=body;this.setData({pending:true});await this.write(body)
  },
  async retry(){if(this.data.busy||!this.current()||!this.pendingBody)return;this.setData({busy:true,error:''});await this.write(this.pendingBody)},
  async write(body){
    try{
      const status=await day.write(this.session,body);if(!this.current())return
      wx.removeStorageSync(this.pendingKey);this.pendingBody=null
      this.setData({pending:false,status,preview:null,notice:status.status==='CLOSED'?'结店已确认，可在门店报表中查看当日核算。':'开店已确认，请员工先完成早盘，再开始记账。'})
    }catch(e){if(this.current()){
      if(!e.mayHaveWritten){wx.removeStorageSync(this.pendingKey);this.pendingBody=null;this.setData({pending:false,preview:null})}
      this.setData({error:e.mayHaveWritten?'提交结果未确认，请使用“重试原请求”核对，避免重复操作。':e.message||'操作失败'})
    }}finally{if(this.current())this.setData({busy:false})}
  }
})
