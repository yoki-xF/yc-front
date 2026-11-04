// Current migration scope. External service integration resumes only after the user's provider/qualification decision.
const externalMessages=new Set(['sms-channels','sms-templates','sms-logs','mail-accounts','mail-templates','mail-logs','social-clients','social-users'])
function deferredEntry(entry){return entry.group==='支付中心'||externalMessages.has(String(entry.key||'').replace(/^messages:/,''))}
function block(page,kind){if(kind==='payment'||externalMessages.has(kind)){page.setData({deferred:true,loading:false,error:'此功能已预留，第三方接入方案确定后再启用。'});return true}return false}
module.exports={externalMessages,deferredEntry,block}
