const api = require('../../../utils/admin-pay/transactions')
Page({
  data: { kind:'order', title:'支付订单', rows:[], page:0, total:0, loading:false, loaded:false, error:'', detail:null, keyword:'', filters:{}, exporting:false,queryDirty:false },
  onLoad(options) {if(require('../../../utils/migration-scope').block(this,'payment'))return; this.alive=true; this.session=wx.getStorageSync('yc_session'); const kind=api.definitions[options.kind] ? options.kind : 'order'; this.setData({kind,title:api.definitions[kind].title}); this.load(true) },
  onShow(){if(this.session&&!this.current()){api.unlink(this.exportPath);this.exportPath=null;this.setData({rows:[],detail:null,hasExport:false,error:'账号已变化，请重新进入'})}},
  onUnload() { this.alive=false;api.unlink(this.exportPath) },
  current() { return this.alive && require('../../../utils/request').sameSession(this.session,wx.getStorageSync('yc_session')) },
  input(e) { if(!this.data.loading){api.unlink(this.exportPath);this.exportPath=null;this.setData({keyword:e.detail.value,queryDirty:true,hasExport:false})} },
  filter(e){if(!this.data.loading){api.unlink(this.exportPath);this.exportPath=null;this.setData({['filters.'+e.currentTarget.dataset.key]:e.detail.value,queryDirty:true,hasExport:false})}},
  clearFilters(){if(this.data.loading)return;this.setData({keyword:'',filters:{}});this.load(true)},
  async load(reset) {
    if (this.data.loading) return
    if(reset) this.detailEpoch=(this.detailEpoch||0)+1
    this.setData({loading:true,error:''})
    try {
      const def=api.definitions[this.data.kind]; const ps=await api.permissions(this.session);if(!api.can(ps,def.permission))throw Error('没有查询权限');if(this.current())this.setData({canExport:api.can(ps,'pay:'+this.data.kind+':export'),canSync:api.can(ps,'pay:order:sync')})
      const page=reset?1:this.data.page+1, params={pageNo:page,pageSize:20}
      const applied=reset?api.filters(this.data.kind,this.data.filters,this.data.keyword):(this.applied||{})
      Object.assign(params,applied)
      const result=await api.call(this.session,def.page,{data:params})
      if(!result || !Array.isArray(result.list)) throw Error('返回数据不完整')
      if(!this.current()) return
      this.applied=applied
      if(reset){api.unlink(this.exportPath);this.exportPath=null}
      const rows=result.list.map(api.item)
      this.setData({rows:reset?rows:this.data.rows.concat(rows),page,total:Number(result.total)||0,loaded:true,detail:null,detailId:null,queryDirty:false,hasExport:reset?false:this.data.hasExport})
    } catch(e) { if(this.current()) this.setData({error:e.message||'读取失败'}) } finally { if(this.current()) this.setData({loading:false}) }
  },
  search() { this.load(true) }, more() { if(this.data.rows.length<this.data.total)this.load(false) },
  async detail(e) {
    const epoch=this.detailEpoch=(this.detailEpoch||0)+1
    try { const def=api.definitions[this.data.kind]; await api.permit(this.session,def.permission); const id=api.id(e.currentTarget.dataset.id); const result=await api.call(this.session,def.detail,{data:{id}}); if(!this.current() || epoch!==this.detailEpoch) return; this.setData({detail:api.describe(result),detailId:id,error:''}) }
    catch(e) { if(this.current()) this.setData({error:e.message||'读取详情失败'}) }
  },
  async sync() {
    if(this.syncing || !this.current()) return
    const id=this.data.detailId
    const key='yc_pay_sync_unknown_'+String(this.session.tenantId)+'_'+id
    if(wx.getStorageSync(key)) { this.setData({error:'该订单同步结果未确认，请核对订单状态后联系管理员处理，禁止重复同步'}); return }
    this.syncing=true
    try {
      await api.permit(this.session,'pay:order:sync')
      if(!this.current()) return
      const confirmed=await new Promise(resolve=>wx.showModal({title:'确认同步订单状态',content:'将向支付渠道查询订单 '+id+' 的状态。请确认后继续。',success:r=>resolve(!!r.confirm),fail:()=>resolve(false)}))
      if(!confirmed || !this.current() || this.data.detailId !== id) return
      await api.permit(this.session,'pay:order:sync')
      if(!this.current() || this.data.detailId !== id) return
      wx.setStorageSync(key,true)
      const result=await api.call(this.session,'/pay/admin-native/order-sync?id='+encodeURIComponent(id),{method:'POST'})
      if(!this.current()) return
      if(result===false) { wx.removeStorageSync(key); this.setData({error:'订单不存在或已不处于等待状态，请刷新核对'}) }
      else this.setData({error:'已请求同步；渠道结果需刷新订单核对，禁止重复同步'})
    } catch(e) { if(this.current()) this.setData({error:'同步结果可能未知，请刷新核对订单，禁止重复同步：'+(e.message||'请求失败')}) }
    finally { this.syncing=false }
  },
  async exportCsv(){if(this.data.queryDirty)return this.setData({error:'筛选已修改，请先查询后再导出'});if(this.data.loading||this.data.exporting||!this.data.canExport||!this.current())return;this.setData({exporting:true,error:''});let path;try{path=await api.exportCsv(this.session,this.data.kind,this.applied||{});if(!this.current()){api.unlink(path);return}api.unlink(this.exportPath);this.exportPath=path;this.setData({hasExport:true})}catch(e){api.unlink(path);if(this.current())this.setData({error:e.message})}finally{if(this.current())this.setData({exporting:false})}},
  shareCsv(){if(!this.current()||!this.exportPath)return;if(!wx.shareFileMessage)return this.setData({error:'当前微信版本不支持文件分享'});wx.shareFileMessage({filePath:this.exportPath,fileName:'pay-'+this.data.kind+'.csv',fail:()=>{if(this.current())this.setData({error:'文件未发送，可重新分享'})}})},
  close() { this.detailEpoch=(this.detailEpoch||0)+1; this.setData({detail:null,detailId:null}) }
})
