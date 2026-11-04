const base = require('./wallet')
const definitions = {
  order: { permission: 'pay:order:query', page: '/pay/admin-native/order-page', detail: '/pay/admin-native/order-detail', title: '支付订单' },
  refund: { permission: 'pay:refund:query', page: '/pay/admin-native/refund-page', detail: '/pay/admin-native/refund-detail', title: '退款订单' },
  transfer: { permission: 'pay:transfer:query', page: '/pay/admin-native/transfer-page', detail: '/pay/admin-native/transfer-detail', title: '转账订单' }
}
const fields = {
  id:'编号', appId:'应用编号', appName:'应用名称', merchantOrderId:'商户订单号', merchantRefundId:'商户退款单号', merchantTransferId:'商户转账单号', no:'单号', channelOrderNo:'渠道单号', channelRefundNo:'渠道退款单号', channelTransferNo:'渠道转账单号', subject:'标题', body:'描述', status:'状态', channelCode:'渠道', amount:'支付金额', payPrice:'支付金额', refundPrice:'退款金额', price:'金额', channelFeePrice:'手续费', channelFeeRate:'手续费比例', refundTimes:'退款次数', reason:'退款原因', userName:'收款人姓名', alipayLogonId:'支付宝账号', openid:'微信 openid', userIp:'IP', notifyUrl:'通知地址', channelErrorCode:'渠道错误码', channelErrorMsg:'渠道错误信息', channelUserId:'渠道用户', channelNotifyData:'渠道通知内容', createTime:'创建时间', updateTime:'更新时间', successTime:'成功时间', expireTime:'失效时间'
}
const amounts = ['amount','payPrice','refundPrice','price','channelFeePrice']
function describe(data) {
  if (!data || typeof data !== 'object') throw Error('记录不存在')
  return Object.keys(fields).filter(k => data[k] !== undefined && data[k] !== null).map(k => {
    let value = data[k]
    if (amounts.includes(k)) value = base.yuan(value) + ' 元'
    else if (k === 'id' || k === 'appId') { try { value = base.id(value) } catch (_) { value = '编号精度不足' } }
    else if (Array.isArray(value)) value = value.join('-')
    else value = String(value)
    return { key:k, label:fields[k], value }
  })
}
function item(row) {
  let identifier = ''
  try { identifier = base.id(row.id) } catch (_) {}
  return { id:identifier, title:row.subject || row.merchantOrderId || row.merchantRefundId || row.merchantTransferId || '记录', status:row.status, amount:base.yuan(row.refundPrice !== undefined ? row.refundPrice : row.price), unsafe:!identifier }
}
module.exports = { ...base, definitions, describe, item }
function filters(kind,form,keyword){
 const result={};form=form||{}
 const fields=kind==='order'?['appId','channelCode','status','channelOrderNo','no']:kind==='refund'?['appId','channelCode','status','merchantRefundId','channelOrderNo','channelRefundNo']:['appId','channelCode','status','type','no','userName','channelTransferNo']
 for(const key of fields){const value=String(form[key]==null?'':form[key]).trim();if(!value)continue;if(key==='appId')result[key]=base.id(value);else if(['status','type'].includes(key)){if(!/^\d{1,3}$/.test(value))throw Error('状态或类型须为0至999的整数');result[key]=Number(value)}else{if(value.length>128)throw Error('筛选内容过长');result[key]=value}}
 if(String(keyword||'').trim()){if(keyword.trim().length>128)throw Error('商户单号过长');result[kind==='transfer'?'merchantTransferId':'merchantOrderId']=keyword.trim()}
 const start=form.start||'',end=form.end||'';if(start||end){if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end)throw Error('请选择完整且顺序正确的日期范围');result['createTime[0]']=start+' 00:00:00';result['createTime[1]']=end+' 23:59:59'}
 return result
}
function unlink(path){if(path)try{wx.getFileSystemManager().unlink({filePath:path,fail:()=>{}})}catch(_){}}
async function exportCsv(session,kind,params){if(!definitions[kind])throw Error('交易类型无效');await base.permit(session,'pay:'+kind+':export');const {sameSession}=require('../request'),current=wx.getStorageSync('yc_session');if(!sameSession(current,session))throw Error('账号已变化');const query=Object.keys(params).map(key=>encodeURIComponent(key)+'='+encodeURIComponent(params[key])).join('&');let path;try{await new Promise((resolve,reject)=>wx.downloadFile({url:require('../config').apiBase.replace(/\/$/,'')+'/pay/admin-native/'+kind+'-export?'+query,header:{Authorization:'Bearer '+current.accessToken,'tenant-id':String(current.tenantId)},success:r=>{path=r.tempFilePath;const type=String((r.header||{})['Content-Type']||(r.header||{})['content-type']||'');if(r.statusCode!==200||!path||!/text\/csv/i.test(type))return reject(Error('导出失败，请检查权限或缩小筛选范围至2000条以内'));resolve()},fail:()=>reject(Error('导出失败，请检查网络'))}));if(!sameSession(wx.getStorageSync('yc_session'),session))throw Error('账号已变化');return path}catch(e){unlink(path);throw e}}
module.exports.filters=filters;module.exports.exportCsv=exportCsv;module.exports.unlink=unlink
