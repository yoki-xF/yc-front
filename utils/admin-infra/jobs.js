const { request, sameSession } = require('../request')
function auth(session) {
  const current = wx.getStorageSync('yc_session')
  if (!session || !sameSession(session, current)) throw Error('账号已变化，请重新进入')
  return { Authorization: 'Bearer ' + current.accessToken, 'tenant-id': String(current.tenantId) }
}
async function call(session, resource, action, method, data) {
  const header = auth(session)
  try {
    const result = await request('/infra/admin-native/' + resource + '/' + action, { method, data, header })
    auth(session)
    return result
  } catch (e) {
    if (method !== 'GET' && (e.code == null || e.code >= 500)) e.mayHaveWritten = true
    throw e
  }
}
function id(value) { if (!/^[1-9]\d*$/.test(String(value))) throw Error('任务编号无效'); return String(value) }
function revision(value) { if (!/^[a-f0-9]{64}$/.test(String(value || ''))) throw Error('版本缺失，请重新读取'); return value }
function payload(v, editing) {
  const result = {}
  for (const k of ['name', 'handlerName', 'cronExpression']) {
    const text = String(v[k] || '').trim()
    if (!text || text.length > 128) throw Error('请填写有效的任务名称、处理器和 CRON 表达式')
    result[k] = text
  }
  if (v.handlerParam) { result.handlerParam = String(v.handlerParam); if (result.handlerParam.length > 2000) throw Error('处理器参数过长') }
  for (const k of ['retryCount', 'retryInterval', 'monitorTimeout']) {
    const text = String(v[k] == null ? '' : v[k]).trim()
    if (!/^\d{1,9}$/.test(text)) throw Error('重试及超时设置须为非负整数')
    result[k] = Number(text)
  }
  if (editing) { result.id = id(v.id); result.revision = revision(v.revision) }
  return result
}
module.exports = {
  page: (s, data) => call(s, 'job', 'page', 'GET', data),
  get: (s, value) => call(s, 'job', 'get', 'GET', { id: id(value) }),
  next: (s, value) => call(s, 'job', 'get_next_times', 'GET', { id: id(value) }),
  logs: (s, data) => call(s, 'job-log', 'page', 'GET', data),
  save: (s, v, editing) => call(s, 'job', editing ? 'update' : 'create', editing ? 'PUT' : 'POST', payload(v, editing)),
  remove: (s, value, rev) => call(s, 'job', 'delete?id=' + id(value) + '&revision=' + revision(rev), 'DELETE'),
  status: (s, value, status, rev) => call(s, 'job', 'update-status?id=' + id(value) + '&status=' + (status === 1 ? 1 : 2) + '&revision=' + revision(rev), 'PUT'),
  trigger: (s, value, rev) => call(s, 'job', 'trigger?id=' + id(value) + '&revision=' + revision(rev), 'PUT')
}
