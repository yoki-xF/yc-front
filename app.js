const {newSessionKey}=require('./utils/request')
App({onLaunch(){const session=wx.getStorageSync('yc_session');if(session&&session.accessToken&&!session.sessionKey)wx.setStorageSync('yc_session',{...session,sessionKey:newSessionKey()})}})
