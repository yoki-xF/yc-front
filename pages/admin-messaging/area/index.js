const {request}=require('../../../utils/request'),auth=require('../../../utils/boss/api')
Page({
 data:{loading:true,error:'',rows:[],trail:[],ip:'',ipResult:''},
 onLoad(){this.session=wx.getStorageSync('yc_session');this.tree=[];this.stack=[];this.load()},onUnload(){this.disposed=true},
 header(){if(this.disposed)throw Error('页面已关闭');const s=auth.active(this.session);return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)}},
 async load(){this.setData({loading:true,error:''});try{const r=await request('/system/area/tree',{header:this.header()});this.header();if(!Array.isArray(r))throw Error('地区数据不完整');this.tree=r;this.stack=[];this.show()}catch(e){if(!this.disposed)this.setData({error:e.message})}finally{if(!this.disposed)this.setData({loading:false})}},
 show(){const parent=this.stack.at(-1);this.setData({rows:(parent?parent.children:this.tree).map(x=>({id:String(x.id),name:x.name,hasChildren:Array.isArray(x.children)&&x.children.length>0})),trail:this.stack.map(x=>x.name)})},
 open(e){try{this.header();const list=this.stack.length?this.stack.at(-1).children:this.tree,node=list.find(x=>String(x.id)===String(e.currentTarget.dataset.id));if(node&&node.children&&node.children.length){this.stack.push(node);this.show()}}catch(error){this.setData({error:error.message})}},
 back(){try{this.header();this.stack.pop();this.show()}catch(e){this.setData({error:e.message})}},input(e){this.setData({ip:e.detail.value})},
 async locate(){if(this.data.loading)return;const ip=this.data.ip.trim();if(!ip||ip.length>45||!/^[a-fA-F0-9:.]+$/.test(ip)){this.setData({error:'请输入有效的IPv4或IPv6地址'});return}this.setData({loading:true,error:'',ipResult:''});try{const r=await request('/system/area/get-by-ip',{data:{ip},header:this.header()});this.header();if(typeof r!=='string')throw Error('地区查询结果无效');this.setData({ipResult:r})}catch(e){if(!this.disposed)this.setData({error:e.message})}finally{if(!this.disposed)this.setData({loading:false})}}
})
