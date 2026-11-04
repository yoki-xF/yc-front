const { request, sameSession: matchesSession } = require('../../utils/request')
function current(session) { return matchesSession(session,wx.getStorageSync('yc_session')) }
function maskPhone(value) {
  if (!value) return '未填写'
  const phone = String(value)
  return phone.length === 11 ? phone.slice(0, 3) + '****' + phone.slice(-4) : '****'
}
Page({
  data: { profile: null, tenantName: '', phone: '', loading: false, error: '', sessionExpired: false },
  onShow() {
    this.version = (this.version || 0) + 1
    const session = wx.getStorageSync('yc_session')
    this.setData({ profile: null, tenantName: '', phone: '', loading: false, error: '', sessionExpired: false })
    if (!session || !session.accessToken) { this.setData({ error: '请先登录' }); return }
    this.load(session)
  },
  onHide() { this.version++ },
  async load(session) {
    const version = ++this.version
    this.setData({ loading: true, error: '', sessionExpired: false })
    try {
      const profile = await request('/system/user/profile/get', { header: { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) } })
      if (!profile || profile.id == null) throw new Error('未读取到个人信息')
      if (current(session) && version === this.version) this.setData({ profile, phone: maskPhone(profile.mobile), tenantName: session.tenantName || '未提供' })
    } catch (error) {
      if (current(session) && version === this.version) this.setData({ error: error.message || '读取个人信息失败', sessionExpired: error.code === 401 })
    } finally {
      if (current(session) && version === this.version) this.setData({ loading: false })
    }
  },
  retry() {
    const session = wx.getStorageSync('yc_session')
    if ((!session || this.data.sessionExpired) && !this.data.loading) wx.redirectTo({ url: '/pages/login/index' })
    else if (session && session.accessToken && !this.data.loading) this.load(session)
  }
})
