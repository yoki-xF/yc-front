const { request, sameSession } = require('../../utils/request')
const { period } = require('../../utils/report-period')
const tabs = ['今日', '本周', '本月'], kinds = ['day', 'week', 'month']
Page({
  data: { tabs, deptName: '', tab: 0, loading: true, error: '', report: null, invalidEntry: false },
  onLoad(options = {}) {
    this.session = wx.getStorageSync('yc_session')
    this.deptId = String(options.deptId || '')
    let deptName = String(options.deptName || '')
    try { deptName = decodeURIComponent(deptName) } catch (_) { /* Keep the supplied display name. */ }
    this.setData({ deptName })
    this.load()
  },
  onShow() { if (this.hidden) { this.hidden = false; this.load() } },
  onHide() { this.hidden = true; this.version = (this.version || 0) + 1; this.setData({ report: null, loading: false }) },
  onUnload() { this.version = (this.version || 0) + 1; this.destroyed = true },
  current(version) { return version === this.version && !this.destroyed && !this.hidden && sameSession(this.session, wx.getStorageSync('yc_session')) },
  changeTab(event) {
    const tab = Number(event.currentTarget.dataset.tab)
    if (!Number.isInteger(tab) || tab < 0 || tab > 2 || tab === this.data.tab || this.data.invalidEntry) return
    this.setData({ tab, report: null, error: '' })
    this.load()
  },
  retry() { if (!this.data.loading && !this.data.invalidEntry) this.load() },
  backToWorkspace() { wx.switchTab({ url: '/pages/index/index' }) },
  async load() {
    if (this.destroyed || this.hidden) return
    const session = wx.getStorageSync('yc_session'), dept = this.deptId
    if (!session || !sameSession(this.session, session) || !/^[1-9]\d*$/.test(dept)) {
      this.setData({ loading: false, report: null, invalidEntry: true, error: '登录或门店信息已失效，请从工作台重新进入' })
      return
    }
    const version = this.version = (this.version || 0) + 1, range = period(kinds[this.data.tab])
    this.setData({ loading: true, error: '', report: null, invalidEntry: false })
    try {
      const report = await request('/sport/wx/store/unified-report', { data: { deptId: dept, ...range }, header: { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) } })
      if (!report || !Array.isArray(report.days) || String(report.deptId) !== dept || report.start !== range.start || report.end !== range.end) throw Error('报表数据不完整，请重试')
      if (this.current(version)) this.setData({ report })
    } catch (error) {
      if (this.current(version)) this.setData({ error: error.message || '报表读取失败，请重试' })
    } finally {
      if (this.current(version)) this.setData({ loading: false })
      else if (version === this.version && !this.destroyed && !this.hidden) this.setData({ loading: false, report: null, invalidEntry: true, error: '账号已切换，请从工作台重新进入' })
    }
  }
})
