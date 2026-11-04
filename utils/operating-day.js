const { request, sameSession } = require('./request')

// A page retains its original context until it is closed. A stale form is never rebound on submit.
async function load(page, prefix, suffix) {
  const session = wx.getStorageSync('yc_session'), dept = String(page.deptId), user = String(page.userId)
  if (!sameSession(page.session, session)) throw Error('账号已切换，请返回重新进入')
  const day = await request('/sport/wx/store/operating-day', { data: { deptId: dept }, header: { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) } })
  if (!sameSession(page.session, wx.getStorageSync('yc_session')) || String(page.deptId) !== dept || String(page.userId) !== user || page.destroyed) throw Error('账号或门店已变化，请返回重新进入')
  if (!day || !/^[1-9]\d*$/.test(day.actorId || '') || day.status !== 'OPEN' || typeof day.id !== 'string' || !/^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(day.id) || String(day.deptId) !== dept || !/^\d{4}-\d{2}-\d{2}$/.test(day.businessDate || '')) throw Error('门店尚未开店或营业日信息无效，请联系有权限人员')
  page.userId = day.actorId
  page.operatingDay = Object.freeze({ id: day.id, businessDate: day.businessDate, deptId: dept, userId: day.actorId })
  if (prefix) page.draftKey = [prefix, String(session.tenantId), day.actorId, dept, day.id].concat(suffix).join('_')
  return page.operatingDay
}
async function bind(page, prefix, suffix = []) {
  if (page.operatingDay) return page.operatingDay
  if (!page.operatingDayFlight) {
    const flight = load(page, prefix, suffix)
    page.operatingDayFlight = flight
    flight.finally(() => { if (page.operatingDayFlight === flight) page.operatingDayFlight = null }).catch(() => {})
  }
  return page.operatingDayFlight
}
function header(page, base) {
  if (!page.operatingDay || String(page.deptId) !== page.operatingDay.deptId || String(page.userId) !== page.operatingDay.userId || page.destroyed || !sameSession(page.session, wx.getStorageSync('yc_session'))) throw Error('营业日或账号已失效，请返回重新进入')
  return Object.assign({}, base, { 'X-Operating-Day': page.operatingDay.id })
}
module.exports = { bind, header }
