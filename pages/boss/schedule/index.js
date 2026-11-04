const api=require('../../../utils/boss/api')
const schedules=require('../../../utils/boss/schedules')
Page({
  data:{loading:true,optionsLoading:false,busy:false,error:'',notice:'',saved:false,uncertain:false,editing:false,depts:[],users:[],configs:[],deptIndex:-1,userIndex:-1,configIndex:-1,statusIndex:0,statuses:['正常','请假','调休'],date:''},
  onLoad(o){this.session=wx.getStorageSync('yc_session');this.id=o.id||null;this.version=0;this.optionsVersion=0;this.setData({editing:!!this.id});this.load()},
  onUnload(){this.disposed=true;this.version++;this.optionsVersion++},
  onShow(){if(this.opened&&!this.current()){this.version++;this.setData({loading:false,optionsLoading:false,busy:false,depts:[],users:[],configs:[],error:'账号已变化，请返回重新进入'})}this.opened=true},
  current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(_){return false}},
  async load(){
    const version=++this.version;this.setData({loading:true,error:'',depts:[],users:[],configs:[],deptIndex:-1,userIndex:-1,configIndex:-1})
    try{
      await schedules.allowed(this.session,this.id?'update':'create')
      const depts=await api.options(this.session),record=this.id?await schedules.get(this.session,this.id):{}
      if(version!==this.version)return
      this.original=record;this.setData({depts,date:record.scheduleDate?String(record.scheduleDate).slice(0,10):'',statusIndex:[1,2,3].includes(Number(record.status))?Number(record.status)-1:0})
      if(this.id){const index=depts.findIndex(d=>String(d.id)===String(record.deptId));if(index<0)throw Error('排班所属门店已不可用');this.setData({deptIndex:index});await this.loadOptions(record.deptId,record)}
    }catch(e){if(version===this.version)this.setData({error:e.message||'读取失败'})}
    finally{if(version===this.version)this.setData({loading:false})}
  },
  async loadOptions(deptId,record={}){
    const version=++this.optionsVersion;this.setData({optionsLoading:true,users:[],configs:[],userIndex:-1,configIndex:-1,error:''})
    try{const opts=await schedules.options(this.session,deptId);if(version!==this.optionsVersion||!this.current())return;this.setData({users:opts.users,configs:opts.configs,userIndex:opts.users.findIndex(u=>String(u.id)===String(record.userId)),configIndex:opts.configs.findIndex(c=>String(c.id)===String(record.configId))})}
    catch(e){if(version===this.optionsVersion&&this.current())this.setData({error:e.message||'读取班次失败'})}
    finally{if(version===this.optionsVersion&&this.current())this.setData({optionsLoading:false})}
  },
  pick(e){if(this.data.busy||this.data.saved||this.data.uncertain||!this.current())return;const key=e.currentTarget.dataset.key,index=Number(e.detail.value);if(key==='deptIndex'){if(this.id||!this.data.depts[index])return;this.setData({deptIndex:index});this.loadOptions(this.data.depts[index].id)}else if(['userIndex','configIndex','statusIndex'].includes(key))this.setData({[key]:index})},
  date(e){if(!this.data.busy&&!this.data.saved&&!this.data.uncertain&&this.current())this.setData({date:e.detail.value})},
  values(){const d=this.data;return {deptId:d.depts[d.deptIndex]&&d.depts[d.deptIndex].id,userId:d.users[d.userIndex]&&d.users[d.userIndex].id,configId:d.configs[d.configIndex]&&d.configs[d.configIndex].id,date:d.date,status:d.statusIndex+1}},
  async submit(){
    if(this.data.busy||this.data.loading||this.data.optionsLoading||this.data.saved||this.data.uncertain||!this.current())return
    const values=this.values(),departments=this.data.depts,options={users:this.data.users,configs:this.data.configs}
    try{schedules.payload(values,this.original,departments,options)}catch(e){this.setData({error:e.message});return}
    this.setData({busy:true,error:''})
    const approved=await new Promise(resolve=>wx.showModal({title:'确认保存排班',content:'请核对门店、员工、班次和日期。已有打卡的记录不可在此修改。',success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
    if(!approved||!this.current()){if(this.current())this.setData({busy:false});return}
    try{await schedules.save(this.session,values,this.original,departments,options);if(this.current())this.setData({saved:true,notice:'排班已保存，请返回列表核对。'})}
    catch(e){if(this.current())this.setData({uncertain:!!e.mayHaveWritten,error:e.mayHaveWritten?'保存结果尚未确认，请返回列表核对，避免重复创建。':e.message||'保存失败'})}
    finally{if(this.current())this.setData({busy:false})}
  },
  retry(){if(!this.data.busy){this.optionsVersion=(this.optionsVersion||0)+1;this.load()}},
  back(){wx.navigateBack()}
})
