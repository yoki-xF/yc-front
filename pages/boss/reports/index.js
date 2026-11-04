const api=require('../../../utils/boss/api')
const reporting=require('../../../utils/boss/reporting')
const {can}=require('../../../utils/boss/resources')
function today(){const d=new Date();return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-')}
Page({
 data:{loading:true,busy:false,error:'',depts:[],deptIndex:0,start:'',end:'',period:'day',tab:'report',report:null,rows:[],hasRows:false,selectedStore:null,days:[]},
 onLoad(){this.version=0;this.setData({...reporting.period('day',today())});this.init()},
 onShow(){if(this.opened)this.init();this.opened=true},
 onHide(){this.version++;this.setData({busy:false})},
 onUnload(){this.disposed=true;this.version++;this.setData({report:null,rows:[],days:[],selectedStore:null})},
 current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(e){return false}},
 async init(){const version=++this.version;this.session=wx.getStorageSync('yc_session');this.setData({loading:true,busy:false,error:'',report:null,rows:[],hasRows:false,days:[],selectedStore:null,depts:[]});try{const[info,depts]=await Promise.all([api.identity(this.session),api.options(this.session)]);if(version!==this.version||!this.current())return;if(!can(info.permissions,'sport:check-ggl:query')&&!can(info.permissions,'sport:check-service:query'))throw Error('当前账号没有报表权限');this.setData({depts:[{id:'',name:'全部可见门店'},...depts],deptIndex:0,loading:false});await this.load()}catch(e){if(version===this.version&&this.current())this.setData({error:e.message||'读取失败',loading:false})}},
 invalidate(patch){this.version++;this.setData({...patch,report:null,rows:[],hasRows:false,selectedStore:null,days:[],error:''})},
 period(e){if(this.data.busy||this.data.loading)return;const kind=e.currentTarget.dataset.kind;if(!['day','week','month','custom'].includes(kind))return;try{this.invalidate({period:kind,...(kind==='custom'?{}:reporting.period(kind,this.data.start||today()))})}catch(e){this.setData({error:e.message})}},
 date(e){if(this.data.busy)return;const key=e.currentTarget.dataset.key;if(['start','end'].includes(key))this.invalidate({[key]:e.detail.value,period:'custom'})},
 pick(e){if(this.data.busy)return;const index=Number(e.detail.value);if(this.data.depts[index])this.invalidate({deptIndex:index})},
 tab(e){const tab=e.currentTarget.dataset.tab;if(['report','rank'].includes(tab)){this.setData({tab,selectedStore:null,days:[]});this.present()}},
 present(){if(!this.data.report)return;const rows=this.data.tab==='rank'?this.data.report.ranked:this.data.report.rows;this.setData({rows,hasRows:rows.length>0})},
 details(e){if(!this.data.report)return;const store=this.data.report.rows.find(r=>r.deptId===String(e.currentTarget.dataset.id));if(store)this.setData({selectedStore:{id:store.deptId,name:store.deptName},days:store.days})},
 async load(){if(this.data.loading||this.data.busy||!this.current())return;const dept=this.data.depts[this.data.deptIndex];if(!dept)return;const filters={start:this.data.start,end:this.data.end,...(dept.id?{deptId:String(dept.id)}:{})};try{reporting.days(filters.start,filters.end)}catch(e){this.setData({error:e.message});return}const version=++this.version;this.setData({busy:true,error:'',report:null,rows:[],hasRows:false,selectedStore:null,days:[]});try{const report=await reporting.read(this.session,filters);if(version!==this.version||!this.current())return;this.setData({report:{...report,range:filters.start+' 至 '+filters.end}});this.present()}catch(e){if(version===this.version&&this.current())this.setData({error:e.message||'查询失败'})}finally{if(version===this.version&&this.current())this.setData({busy:false})}},
 retry(){if(!this.data.loading&&!this.data.busy){if(!this.data.depts.length)this.init();else this.load()}}
})
