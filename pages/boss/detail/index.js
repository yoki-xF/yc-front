const api = require('../../../utils/boss/api')
Page({
  data: { loading: true, error: '', record: null, deleteBusy: false, deleteUncertain: false, deleteDone: false },
  onLoad(o) { this.session = wx.getStorageSync('yc_session'); this.type = o.type; this.id = o.id; this.setData({type:this.type}); this.version = 0; this.load() },
  onUnload() { this.disposed=true;this.version++ },
  onShow() { if(this.opened&&!this.data.loading&&!this.data.deleteBusy&&!this.data.deleteUncertain&&!this.data.deleteDone)this.load();this.opened=true },
  vouchers() { if(this.type==='business'&&this.data.record)wx.navigateTo({url:'/pages/boss/vouchers/index?id='+encodeURIComponent(this.id)}) },
  edit() { if(this.data.record&&this.data.record.canEdit)wx.navigateTo({url:this.type==='attendance'?'/pages/boss/schedule/index?id='+encodeURIComponent(this.id):'/pages/boss/form/index?type='+encodeURIComponent(this.type)+'&id='+encodeURIComponent(this.id)}) },
  correct() { if(this.data.record&&this.data.record.canCorrect)wx.navigateTo({url:'/pages/boss/correction/index?type='+encodeURIComponent(this.type)+'&id='+encodeURIComponent(this.id)}) },
  history() { if(this.data.record&&this.data.record.hasCorrectionHistory)wx.navigateTo({url:'/pages/boss/correction/index?history=1&type='+encodeURIComponent(this.type)+'&id='+encodeURIComponent(this.id)}) },
  manageUser() { if(this.data.record&&this.data.record.canManageUser)wx.navigateTo({url:'/pages/boss/user-actions/index?id='+encodeURIComponent(this.id)}) },
  manageRole() { if(this.data.record&&this.data.record.canManageRole)wx.navigateTo({url:'/pages/boss/role-actions/index?id='+encodeURIComponent(this.id)}) },
  current() { if(this.disposed)return false;try{api.active(this.session);return true}catch(e){return false} },
  async removeCatalog() {
    const record=this.data.record
    if(!this.current()||this.data.deleteBusy||this.data.deleteUncertain||this.data.deleteDone||!record||!record.canDelete)return
    this.setData({deleteBusy:true,error:''})
    const confirmed=await new Promise(resolve=>wx.showModal({title:this.type==='attendance'?'取消未打卡排班':this.type==='materials'?'删除未引用物料':'删除成本记录',content:this.type==='attendance'?'仅今天或未来尚未打卡的排班可取消；历史和已有打卡的排班将保留。':this.type==='materials'?'仅未被库存、盘点或单据引用的物料可删除。有关联记录会保留，请确认当前物料。':'删除后成本记录将不再显示，请确认已核对。',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))
    if(!confirmed||!this.current()){if(this.current())this.setData({deleteBusy:false});return}
    try {api.active(this.session);await api.removeCatalog(this.session,this.type,this.id,record.revision);if(!this.current())return;this.setData({record:null,deleteDone:true,error:''})}
    catch(e){if(this.current())this.setData({error:e.mayHaveWritten?'删除结果未确认，请返回列表核对。':(e.message||'删除失败，请重新读取后重试。'),deleteUncertain:!!e.mayHaveWritten})}
    finally{if(this.current())this.setData({deleteBusy:false})}
  },
  back() { wx.navigateBack() },
  retry() { if(this.data.deleteUncertain){wx.navigateBack();return}if (!this.data.loading) this.load() },
  async load() {
    const version = ++this.version
    this.setData({ loading: true, error: '', record: null })
    try { const record = await api.detail(this.session, this.type, this.id); if (version === this.version) this.setData({ record }) }
    catch (e) { if (version === this.version) this.setData({ error: e.message || '读取失败' }) }
    finally { if (version === this.version) this.setData({ loading: false }) }
  }
})
