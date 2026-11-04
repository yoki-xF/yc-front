const {sameSession}=require('../request')
function active(session){const now=wx.getStorageSync('yc_session');if(!session||!sameSession(session,now))throw Error('账号已变化，请重新进入');return now}
function url(base){if(typeof base!=='string'||!/^https?:\/\/[^?#]+$/.test(base))throw Error('服务地址无效');if(/^http:/.test(base)&&!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(base))throw Error('公网连接需要HTTPS');return base.replace(/^https:/,'wss:').replace(/^http:/,'ws:').replace(/\/$/,'')+'/infra/admin-native/ws'}
function message(text,toUserId,requestId){text=String(text||'').trim();toUserId=String(toUserId||'').trim();if(!text||text.length>1000)throw Error('消息须为1至1000字');if(toUserId&&!/^[1-9]\d{0,18}$/.test(toUserId))throw Error('接收人编号无效');return {type:'message',text,toUserId,requestId}}
module.exports={active,url,message}
