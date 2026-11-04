const model=require('../../../utils/admin-infra/socket'),auth=require('../../../utils/boss/api'),config=require('../../../utils/config'),{can}=require('../../../utils/boss/resources')
Page({
 data:{status:'未连接',connected:false,connecting:false,busy:false,text:'',target:'',rows:[],error:'',uncertain:false,canSend:false},
 onLoad(){this.session=wx.getStorageSync('yc_session');this.generation=0},onHide(){this.disconnect()},onUnload(){this.dead=true;this.disconnect()},
 current(){try{model.active(this.session);return !this.dead}catch(_){return false}},
 input(e){if(this.current()&&!this.data.busy)this.setData({[e.currentTarget.dataset.key]:e.detail.value})},
 disconnect(){this.generation++;clearInterval(this.heartbeat);clearTimeout(this.ackTimer);this.heartbeat=null;this.ackTimer=null;if(this.pending){this.pending=null;if(!this.dead)this.setData({uncertain:true,error:'连接中断，发送结果未确认，请先核对接收记录。'})}const task=this.task;this.task=null;if(task)try{task.close({code:1000,reason:'closed'})}catch(_){}if(!this.dead)this.setData({connected:false,connecting:false,busy:false,status:'未连接'})},
 async connect(){if(this.data.connecting||this.data.connected||!this.current())return;this.disconnect();const generation=this.generation;this.setData({connecting:true,error:'',status:'正在连接'});try{const info=await auth.identity(this.session),ps=info.permissions;if(!can(ps,'infra:websocket:query'))throw Error('没有连接权限');const now=model.active(this.session);if(generation!==this.generation||!this.current())return;this.setData({canSend:can(ps,'infra:websocket:send')});const task=wx.connectSocket({url:model.url(config.apiBase),header:{Authorization:'Bearer '+now.accessToken,'tenant-id':String(now.tenantId)},fail:()=>{if(generation===this.generation&&this.current()){this.disconnect();this.setData({error:'连接失败，请核对服务和微信socket合法域名'})}}});this.task=task;const live=()=>generation===this.generation&&this.current();task.onOpen(()=>{if(!live()){task.close({});return}this.lastPong=Date.now();this.setData({status:'已连接',connected:true,connecting:false});this.heartbeat=setInterval(()=>{if(!live()||Date.now()-this.lastPong>45000){this.disconnect();return}task.send({data:'{"type":"ping"}',fail:()=>{if(live())this.disconnect()}})},20000)});task.onMessage(event=>{if(!live()){this.disconnect();return}try{const v=JSON.parse(event.data);if(v.type==='pong'){this.lastPong=Date.now();return}if(v.type==='connected')return;if(v.type==='ack'&&v.requestId===this.pending){clearTimeout(this.ackTimer);this.pending=null;this.setData({busy:false,text:'',status:v.duplicate?'已确认此请求曾被处理':'已确认：'+Number(v.deliveredConnections||0)+'个连接收到'});return}if(v.type==='message'&&typeof v.text==='string'){const rows=[{key:String(v.requestId)+':'+Date.now(),sender:String(v.fromUserId),text:v.text.slice(0,1000),time:new Date().toLocaleTimeString()}].concat(this.data.rows).slice(0,100);this.setData({rows})}}catch(_){this.setData({error:'收到无法识别的消息'})}});task.onClose(()=>{if(live()){this.disconnect();this.setData({error:'连接已关闭，可重新连接；未确认消息不会自动重发'})}});task.onError(()=>{if(live()){this.disconnect();this.setData({error:'连接发生错误，请重新连接'})}})}catch(e){if(generation===this.generation&&this.current()){this.disconnect();this.setData({error:e.message})}}},
 send(){
  if(!this.current()||!this.data.connected||this.data.busy||this.data.uncertain||!this.data.canSend)return
  let value
  try{value=model.message(this.data.text,this.data.target,'ws_'+Date.now().toString(36)+'_'+Math.random().toString(36).slice(2));if(JSON.stringify(value).length>4000)throw Error('消息过长，请缩短后发送')}
  catch(e){return this.setData({error:e.message})}
  this.setData({busy:true,error:''})
  wx.showModal({title:'确认发送',content:value.toUserId?'发送给已连接的管理员 '+value.toUserId:'发送给当前平台同组织内所有已连接管理员。',
   success:r=>{
    if(!r.confirm||!this.current()||!this.task){if(this.current())this.setData({busy:false});return}
    this.pending=value.requestId
    this.ackTimer=setTimeout(()=>{if(this.pending===value.requestId&&this.current()){this.pending=null;this.setData({busy:false,uncertain:true,error:'未收到确认，发送结果未知；请先核对，勿重复发送'})}},10000)
    this.task.send({data:JSON.stringify(value),fail:()=>{
     if(this.pending===value.requestId&&this.current()){clearTimeout(this.ackTimer);this.pending=null;this.setData({busy:false,uncertain:true,error:'发送结果未知，请先核对，勿重复发送'})}
    }})
   },fail:()=>{if(this.current())this.setData({busy:false})}
  })
 },
 acknowledge(){if(this.data.busy||!this.current())return;wx.showModal({title:'已核对接收记录？',content:'确认后将清空输入并解除本页发送锁定，不会重发消息。',success:r=>{if(r.confirm&&this.current())this.setData({uncertain:false,text:'',error:''})}})}
})
