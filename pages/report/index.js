const { request, sameSession } = require('../../utils/request')
const { period } = require('../../utils/report-period')
const tabs=['今日','本周','本月'], kinds=['day','week','month']
Page({
 data:{tabs,tab:0,loading:true,error:'',report:null},
 onLoad(o){this.session=wx.getStorageSync('yc_session');this.deptId=String(o.deptId||'');this.setData({deptName:o.deptName?decodeURIComponent(o.deptName):''});if(!this.session||!this.deptId){this.setData({loading:false,error:'登录或门店信息已失效，请返回重新进入'});return}this.load()},
 onUnload(){this.version=(this.version||0)+1;this.destroyed=true},
 changeTab(e){const tab=Number(e.currentTarget.dataset.tab);if(!Number.isInteger(tab)||tab<0||tab>2||tab===this.data.tab)return;this.setData({tab,report:null,error:''});this.load()},
 retry(){if(!this.data.loading)this.load()},
 async load(){const session=wx.getStorageSync('yc_session'),dept=this.deptId;if(!sameSession(this.session,session)){this.setData({loading:false,error:'账号已切换，请返回重新进入'});return}const version=this.version=(this.version||0)+1,range=period(kinds[this.data.tab]);this.setData({loading:true,error:''});try{const report=await request('/sport/wx/store/unified-report',{data:{deptId:dept,...range},header:{Authorization:'Bearer '+session.accessToken,'tenant-id':String(session.tenantId)}});if(!report||!Array.isArray(report.days)||String(report.deptId)!==dept||report.start!==range.start||report.end!==range.end)throw Error('报表数据不完整，请重试');if(version===this.version&&!this.destroyed&&this.deptId===dept&&sameSession(this.session,wx.getStorageSync('yc_session')))this.setData({report})}catch(e){if(version===this.version&&!this.destroyed&&this.deptId===dept&&sameSession(this.session,wx.getStorageSync('yc_session')))this.setData({error:e.message||'报表读取失败，请重试'})}finally{if(version===this.version&&!this.destroyed&&this.deptId===dept&&sameSession(this.session,wx.getStorageSync('yc_session')))this.setData({loading:false})}}
})
