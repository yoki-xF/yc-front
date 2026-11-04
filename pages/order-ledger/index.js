const { request, sameSession } = require('../../utils/request')
const header = s => ({ Authorization:'Bearer '+s.accessToken, 'tenant-id':String(s.tenantId) })
const state = s => s === 0 ? '待确认' : s === 1 ? '已确认' : s === 2 ? '已作废' : '状态未知'
function formatTime(value) { if (!value) return '—'; const d=new Date(value); if (Number.isNaN(d.getTime())) return String(value); const p=n=>String(n).padStart(2,'0'); return [d.getFullYear(),p(d.getMonth()+1),p(d.getDate())].join('-')+' '+p(d.getHours())+':'+p(d.getMinutes()) }
Page({
 data:{ type:'purchase', direction:'in', items:[], pageNo:0, total:0, loaded:false, loading:false, error:'' },
 onLoad(options) { this.session=wx.getStorageSync('yc_session'); this.deptId=String(options.deptId || ''); this.userId=String(options.userId || ''); this.setData({deptName:options.deptName ? decodeURIComponent(options.deptName) : ''}); if(!this.session || !this.deptId || !this.userId) {this.setData({error:'登录或门店信息已失效，请返回重新进入'});return} this.load(true) },
 onShow() { if(this.loadedOnce && !this.data.loading && this.current()) this.load(true); this.loadedOnce=true },
 create() { if(this.current()) wx.navigateTo({url:'/pages/'+(this.data.type==='purchase'?'purchase-create':'transfer-create')+'/index?deptId='+this.deptId+'&userId='+this.userId+'&deptName='+encodeURIComponent(this.data.deptName)}) },
 onUnload() { this.version=(this.version||0)+1 },
 current() { return sameSession(this.session,wx.getStorageSync('yc_session')) },
 switchType(e) { const type=e.currentTarget.dataset.type; if(!['purchase','transfer'].includes(type) || type===this.data.type) return; this.setData({type,direction:'in',items:[],pageNo:0,total:0,loaded:false,loading:false,error:''}); this.load(true) },
 switchDirection(e) { const direction=e.currentTarget.dataset.direction; if(!['in','out'].includes(direction) || direction===this.data.direction) return; this.setData({direction,items:[],pageNo:0,total:0,loaded:false,loading:false,error:''}); this.load(true) },
 refresh() { if(!this.data.loading) this.load(true) },
 more() { if(!this.data.loading && this.data.loaded && this.data.items.length<this.data.total) this.load(false) },
 async load(reset) {
  if(!this.current()) {this.setData({error:'账号已切换，请返回重新进入'});return}
  const version=this.version=(this.version||0)+1, type=this.data.type, pageNo=reset ? 1 : this.data.pageNo+1
  this.setData({loading:true,error:''})
  try {
   const result=await request('/sport/wx/order-ledger/page',{data:{deptId:this.deptId,type,direction:this.data.direction,pageNo,pageSize:20},header:header(wx.getStorageSync('yc_session'))})
   if(!result || !Array.isArray(result.list) || !Number.isFinite(Number(result.total))) throw Error('单据数据不完整，请重试')
   if(version!==this.version || !this.current()) return
   const rows=result.list.map(x=>({id:x.id,orderNo:x.orderNo || '未记录单号', status:state(x.stat),amount:x.totalAmount == null ? '—' : String(x.totalAmount), userName:x.userName || '—', created:formatTime(x.createTime), exDeptName:x.exDeptName || '', targetName:x.deptName || '', remark:x.remark || ''}))
   this.setData({items:reset ? rows : this.data.items.concat(rows),pageNo,total:Number(result.total),loaded:true})
  } catch(e) {if(version===this.version && this.current()) this.setData({error:e.message || '读取单据失败，请重试'})}
  finally {if(version===this.version && this.current()) this.setData({loading:false})}
 },
 detail(e) {const id=e.currentTarget.dataset.id; if(!id || !this.current()) return; wx.navigateTo({url:'/pages/order-detail/index?deptId='+this.deptId+'&userId='+this.userId+'&type='+this.data.type+'&id='+id+'&deptName='+encodeURIComponent(this.data.deptName)})}
})
