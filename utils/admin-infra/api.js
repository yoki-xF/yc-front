const { request, sameSession } = require('../request')
const { get } = require('./catalog')
function header(session) { const s=wx.getStorageSync('yc_session'); if (!session || !sameSession(session,s)) throw Error('账号已变化，请重新进入'); return {Authorization:'Bearer '+s.accessToken,'tenant-id':String(s.tenantId)} }
async function call(session, path, options={}) { const result=await request('/infra/admin-native/'+path,{...options,header:header(session)}); header(session); return result }
async function list(session,key,filters,pageNo) { const spec=get(key); const params={}; if(!spec.list) Object.assign(params,{pageNo,pageSize:20}); if(spec.search && filters.keyword) params[spec.search]=filters.keyword; if(key==='job-log' && filters.jobId) params.jobId=filters.jobId; const result=await call(session,key+'/'+(spec.list?'list':'page'),{data:params}); if(spec.list) {if(!Array.isArray(result))throw Error('列表数据不完整'); return {list:result,total:result.length}} if(!result || !Array.isArray(result.list) || !Number.isFinite(Number(result.total))) throw Error('列表数据不完整'); return result }
async function monitor(session) { return call(session,'redis/get-monitor-info') }
module.exports={call,list,monitor,header}
