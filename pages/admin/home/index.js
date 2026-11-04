const api=require('../../../utils/boss/api')
const {visible}=require('../../../utils/admin-entries')
Page({
 data:{loading:true,error:'',groups:[]},
 onShow(){this.session=wx.getStorageSync('yc_session');this.load()},
 onHide(){this.version=(this.version||0)+1},
 onUnload(){this.version=(this.version||0)+1},
 async load(){const version=this.version=(this.version||0)+1;this.setData({loading:true,error:'',groups:[]});try{const info=await api.identity(this.session);if(version!==this.version)return;const groups=[];for(const entry of visible(info)){let group=groups.find(g=>g.title===entry.group);if(!group){group={title:entry.group,entries:[]};groups.push(group)}group.entries.push(entry)}this.setData({groups})}catch(e){if(version===this.version)this.setData({error:e.message||'读取失败'})}finally{if(version===this.version)this.setData({loading:false})}},
 retry(){if(!this.data.loading)this.load()},
 open(e){try{api.active(this.session);const entry=this.data.groups.flatMap(g=>g.entries).find(x=>x.key===e.currentTarget.dataset.key);if(entry)wx.navigateTo({url:entry.url})}catch(error){this.setData({error:error.message,groups:[]})}}
})
