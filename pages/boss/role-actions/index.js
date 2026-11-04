const api=require('../../../utils/boss/api'),actions=require('../../../utils/boss/role-actions')
Page({
 data:{loading:true,busy:false,error:'',notice:'',record:null,menuIds:[],menus:[],visibleMenus:[],menusEmpty:true,keyword:'',scopes:actions.scopes,scopeIndex:-1,departments:[],deptIds:[],uncertain:false},
 onLoad(o){this.session=wx.getStorageSync('yc_session');this.id=o.id;this.version=0;this.load()},
 onUnload(){this.disposed=true;this.version++;this.original=null},
 onShow(){if(this.opened&&!this.current()){this.version++;this.original=null;this.setData({loading:false,busy:false,record:null,menus:[],visibleMenus:[],menuIds:[],departments:[],deptIds:[],error:'账号已变化，请返回重新进入'})}this.opened=true},
 current(){if(this.disposed)return false;try{api.active(this.session);return true}catch(_){return false}},
 async load(){const version=++this.version;this.setData({loading:true,error:'',record:null,keyword:'',menus:[],visibleMenus:[]});try{const record=await actions.get(this.session,this.id);if(version!==this.version)return;this.original=record;this.setData({uncertain:false,record:{name:record.name,canMenus:record.canMenus,canScope:record.canScope,menuWarning:record.menuWarning,scopeWarning:record.scopeWarning},menus:actions.menuLabels(record.menus),menuIds:record.menuIds.map(String),departments:record.departments.map(d=>({...d,checked:record.deptIds.map(String).includes(String(d.id))})),deptIds:record.deptIds.map(String),scopeIndex:actions.scopes.findIndex(s=>s.id===Number(record.dataScope))});this.filter()}catch(e){if(version===this.version)this.setData({error:e.message||'读取失败'})}finally{if(version===this.version)this.setData({loading:false})}},
 filter(){const key=this.data.keyword.trim(),visibleMenus=this.data.menus.filter(m=>!key||m.label.includes(key)).map(m=>({...m,checked:this.data.menuIds.includes(String(m.id))}));this.setData({visibleMenus,menusEmpty:visibleMenus.length===0})},
 search(e){if(!this.data.busy&&this.current()){this.setData({keyword:e.detail.value});this.filter()}},
 menus(e){if(this.data.busy||this.data.uncertain||!this.current())return;this.setData({menuIds:actions.mergeSelection(this.data.menuIds,this.data.visibleMenus,e.detail.value)});this.filter()},
 scope(e){if(!this.data.busy&&!this.data.uncertain&&this.current())this.setData({scopeIndex:Number(e.detail.value)})},
 departments(e){if(!this.data.busy&&!this.data.uncertain&&this.current())this.setData({deptIds:e.detail.value})},
 async submit(e){
  if(this.data.loading||this.data.busy||this.data.uncertain||!this.data.record||!this.current())return
  const action=e.currentTarget.dataset.action,scope=this.data.scopes[this.data.scopeIndex],values={menuIds:[...this.data.menuIds],deptIds:[...this.data.deptIds],dataScope:scope&&scope.id}
  try{actions.payload(action,this.original,values)}catch(error){this.setData({error:error.message});return}
  this.setData({busy:true,error:'',notice:''})
  const content=action==='menus'?'将更新此角色的功能权限，影响拥有该角色的账号。请核对入口及其按钮权限。':scope.id===1?'此角色将可以访问本组织全部数据，请确认授权范围。':'将数据范围调整为“'+scope.name+'”，请核对门店及账号范围。'
  const approved=await new Promise(resolve=>wx.showModal({title:'确认授权：'+this.data.record.name,content,success:r=>resolve(r.confirm),fail:()=>resolve(false)}))
  if(!approved||!this.current()){if(this.current())this.setData({busy:false});return}
  try{await actions.save(this.session,action,this.original,values);if(this.current()){this.setData({notice:'角色授权已保存。'});await this.load()}}
  catch(error){if(this.current())this.setData({uncertain:!!error.mayHaveWritten,error:error.mayHaveWritten?'保存结果尚未确认，请重新读取角色权限核对，不要直接重复提交。':error.message||'授权失败'})}
  finally{if(this.current())this.setData({busy:false})}
 },
 retry(){if(!this.data.loading&&!this.data.busy)this.load()}
})
