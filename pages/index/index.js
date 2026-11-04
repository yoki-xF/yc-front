const { period } = require('../../utils/report-period')
const { request, sameSession: matchesSession } = require('../../utils/request')
function sameSession(session) { return matchesSession(session,wx.getStorageSync('yc_session')) }
function storeKey(session, user) { return 'yc_dept_' + session.tenantId + '_' + user.id }
Page({
  data: { session: null, user: null, depts: [], deptIndex: -1, loading: false, error: '', sessionExpired: false, sales: null, salesLoading: false, salesError: '', salesExpired: false },
  onShow() {
    const session = wx.getStorageSync('yc_session')
    this.profileVersion = (this.profileVersion || 0) + 1
    this.salesVersion = (this.salesVersion || 0) + 1
    this.setData({ session: session || null, user: null, depts: [], deptIndex: -1, sales: null, salesLoading: false, salesError: '', error: '', sessionExpired: false })
    if (session && session.accessToken) this.loadProfile(session)
  },
  async loadProfile(session) {
    const version = ++this.profileVersion
    this.setData({ loading: true, error: '', sessionExpired: false })
    try {
      const profile = await request('/system/auth/get-mobile-permission-info', { header: { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) } })
      if (!profile || !profile.user || profile.user.id == null) throw new Error('未读取到用户信息')
      if (!sameSession(session) || version !== this.profileVersion) return
      const depts = Array.isArray(profile.depts) ? profile.depts.filter(item => item && item.id != null && item.name) : []
      const saved = wx.getStorageSync(storeKey(session, profile.user))
      const savedIndex = depts.findIndex(item => String(item.id) === String(saved))
      const deptIndex = savedIndex >= 0 ? savedIndex : (depts.length ? 0 : -1)
      if (deptIndex >= 0) wx.setStorageSync(storeKey(session, profile.user), depts[deptIndex].id)
      else wx.removeStorageSync(storeKey(session, profile.user))
      const latest = wx.getStorageSync('yc_session')
      this.setData({ session: latest, user: profile.user, depts, deptIndex })
      if (deptIndex >= 0) this.loadSales(latest, depts[deptIndex])
    } catch (error) {
      if (sameSession(session) && version === this.profileVersion) this.setData({ error: error.message || '读取用户信息失败', sessionExpired: error.code === 401 })
    } finally {
      if (sameSession(session) && version === this.profileVersion) this.setData({ loading: false })
    }
  },
  changeDept(event) {
    const index = Number(event.detail.value)
    const { session, user, depts } = this.data
    if (!sameSession(session) || !user || !Number.isInteger(index) || !depts[index]) return
    wx.setStorageSync(storeKey(session, user), depts[index].id)
    const latest = wx.getStorageSync('yc_session')
    this.setData({ session: latest, deptIndex: index, sales: null, salesError: '' })
    this.loadSales(latest, depts[index])
  },
  async loadSales(session, dept) {
    const version = ++this.salesVersion
    this.setData({ salesLoading: true, salesError: '', salesExpired: false })
    const header = { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) }
    try {
      const range = period('month')
      const report = await request('/sport/wx/store/unified-report', { data: { deptId: String(dept.id), ...range }, header })
      if (!report || !Array.isArray(report.days) || String(report.deptId) !== String(dept.id) || report.start !== range.start || report.end !== range.end) throw new Error('销量数据不完整')
      if (sameSession(session) && version === this.salesVersion) this.setData({ session: wx.getStorageSync('yc_session'), sales: report })
    } catch (error) {
      if (sameSession(session) && version === this.salesVersion) this.setData({ salesError: error.message || '读取销量失败', salesExpired: error.code === 401 })
    } finally {
      if (sameSession(session) && version === this.salesVersion) this.setData({ salesLoading: false })
    }
  },
  retrySales() {
    const { session, depts, deptIndex } = this.data
    if (session && sameSession(session) && depts[deptIndex] && !this.data.salesLoading) this.loadSales(wx.getStorageSync('yc_session'), depts[deptIndex])
  },
  async contact() {
    const session = wx.getStorageSync('yc_session')
    if (!session || this.contactBusy) return
    this.contactBusy = true
    try {
      const phone = await request('/infra/config/get-value-by-key', {
        data: { key: 'customerPhone' },
        header: { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) }
      })
      if (!sameSession(session)) return
      if (typeof phone !== 'string' || !phone.trim()) throw new Error('未获取到客服电话')
      wx.makePhoneCall({ phoneNumber: phone.trim(), fail: () => wx.showToast({ title: '未能拨打电话', icon: 'none' }) })
    } catch (error) {
      if (sameSession(session)) wx.showToast({ title: error.message || '未获取到客服电话', icon: 'none' })
    } finally { this.contactBusy = false }
  },
  checkStatus() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!user || !dept) return; wx.navigateTo({ url: '/pages/check-status/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  orders() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!dept) return; wx.navigateTo({ url: '/pages/order-ledger/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  cashTransfer() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!user || !dept) return; wx.navigateTo({ url: '/pages/cash-transfer/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  report() { const { depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!dept) return; wx.navigateTo({ url: '/pages/report/index?deptId=' + dept.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  business() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!user || !dept) return; wx.navigateTo({ url: '/pages/business/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  fund() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!user || !dept) return; wx.navigateTo({ url: '/pages/fund/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  evening() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!user || !dept) return; wx.navigateTo({ url: '/pages/evening/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  morning() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!user || !dept) return; wx.navigateTo({ url: '/pages/morning/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  activity() { const { user, depts, deptIndex } = this.data; const dept = depts[deptIndex]; if (!user || !dept) return; wx.navigateTo({ url: '/pages/activity/index?deptId=' + dept.id + '&userId=' + user.id + '&deptName=' + encodeURIComponent(dept.name) }) },
  inbox(){if(this.data.session)wx.navigateTo({url:'/pages/admin-messaging/inbox/index'})},
  manual() { wx.navigateTo({ url: '/pages/manual/index' }) },
  profile() { wx.navigateTo({ url: '/pages/profile/index' }) },
  login() { wx.navigateTo({ url: '/pages/login/index' }) },
  retry() { const session = wx.getStorageSync('yc_session'); if (session && !this.data.loading) this.loadProfile(session) },
  relogin() { wx.navigateTo({ url: '/pages/login/index' }) },
  logout() {
    wx.showModal({ title: '退出登录', content: '确定退出当前账号吗？', success: async (res) => {
      if (!res.confirm) return
      const session = wx.getStorageSync('yc_session')
      if (!session) return
      try {
        await request('/system/auth/logout', { method: 'POST', header: { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) } })
        if (!sameSession(session)) return
        wx.removeStorageSync('yc_session')
        this.profileVersion++
        this.salesVersion++
        this.setData({ session: null, user: null, depts: [], deptIndex: -1, sales: null, salesLoading: false, salesError: '', loading: false, error: '' })
      } catch (error) { wx.showToast({ title: error.message || '退出失败，请重试', icon: 'none' }) }
    } })
  }
})
