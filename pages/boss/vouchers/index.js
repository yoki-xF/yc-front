const vouchers=require('../../../utils/boss/vouchers')
const api=require('../../../utils/boss/api')
Page({
  data:{loading:false,error:'',items:[],empty:false,busy:false},
  onLoad(o){this.session=wx.getStorageSync('yc_session');this.id=o.id;this.version=0;this.paths=new Set()},
  onShow(){this.disposed=false;this.load()},
  onHide(){this.clear()},
  onUnload(){this.clear()},
  clear(){this.disposed=true;this.version++;for(const path of this.paths||[])vouchers.remove(path);if(this.paths)this.paths.clear();this.setData({items:[],empty:false,busy:false,loading:false})},
  current(v){try{api.active(this.session);return !this.disposed&&v===this.version}catch(e){this.clear();return false}},
  async load(){
    if(this.data.loading||this.disposed)return
    const v=++this.version
    for(const path of this.paths)vouchers.remove(path);this.paths.clear()
    this.setData({loading:true,error:'',items:[],empty:false})
    try{const result=await vouchers.list(this.session,this.id);if(this.current(v)){this.revision=result.revision;this.setData({items:result.items,empty:result.items.length===0})}}
    catch(e){if(!this.disposed&&v===this.version)this.setData({error:e.message||'凭证信息读取失败'})}
    finally{if(!this.disposed&&v===this.version)this.setData({loading:false})}
  },
  async view(e){
    if(this.data.busy||this.disposed)return
    const index=Number(e.currentTarget.dataset.index),item=this.data.items[index],v=this.version
    if(!item||item.index!==index)return
    if(item.path)return
    this.setData({busy:true,error:''})
    try{
      const path=await vouchers.download(this.session,this.id,index,this.revision,()=>this.current(v))
      if(!this.current(v)){vouchers.remove(path);return}
      this.paths.add(path)
      this.setData({items:this.data.items.map(x=>x.index===index?{...x,path}:x)})
    }catch(e){if(!this.disposed&&v===this.version)this.setData({error:e.message||'凭证读取失败'})}
    finally{if(!this.disposed&&v===this.version)this.setData({busy:false})}
  }
})
