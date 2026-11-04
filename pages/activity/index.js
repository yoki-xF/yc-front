const operatingDay = require('../../utils/operating-day')
const { request, sameSession } = require('../../utils/request')
function auth(session) { return { Authorization: 'Bearer ' + session.accessToken, 'tenant-id': String(session.tenantId) } }
Page({
  data: { deptName: '', users: [], userIndex: -1, items: [], loading: true, busy: false, error: '', notice: '', uncertain: false, conflict: false },
  onLoad(options) {
    this.session = wx.getStorageSync('yc_session')
    this.deptId = String(options.deptId || '')
    this.userId = String(options.userId || '')
    this.setData({ deptName: options.deptName ? decodeURIComponent(options.deptName) : '' })
    if (!this.session || !this.deptId || !this.userId) { this.setData({ loading: false, error: '登录或门店信息已失效，请返回重新进入' }); return }
    this.load()
  },
  onUnload() { this.destroyed = true },
  async load() {
    const session = wx.getStorageSync('yc_session')
    if (!sameSession(this.session, session)) { this.setData({ loading: false, error: '账号已切换，请返回重新进入' }); return }
    this.setData({ loading: true, error: '' })
    try {
      await operatingDay.bind(this, 'yc_activity')
      const [users, result] = await Promise.all([
        request('/sport/wx/store/active-staff', { data: { deptId: this.deptId }, header: auth(session) }),
        request('/sport/wx/activity/safe-item', { data: { deptId: this.deptId }, header: operatingDay.header(this, auth(session)) })
      ])
      if (!sameSession(this.session, wx.getStorageSync('yc_session')) || this.destroyed || String(this.deptId) !== this.operatingDay.deptId || String(this.userId) !== this.operatingDay.userId) return
      if (!result || !result.revision || !Array.isArray(result.items)) throw Error('促销数据不完整，请重试')
      const list = (Array.isArray(users) ? users : []).filter(u => u && u.value != null && u.label)
      let items = result.items.map(item => ({ activityId: item.activityId, activityName: item.activityName, salesAmount: item.salesAmount == null ? '' : String(item.salesAmount) }))
      const draft = wx.getStorageSync(this.draftKey)
      this.revision = draft ? draft.revision : result.revision
      const conflict = !!draft && draft.revision !== result.revision
      let userIndex = list.findIndex(user => String(user.value) === String(draft && draft.userId != null ? draft.userId : this.userId))
      if (userIndex < 0) userIndex = -1
      if (draft && Array.isArray(draft.items)) items = draft.items
      this.setData({ users: list, userIndex, items, notice: conflict ? '促销数据已变化，草稿已保留，请记录后加载最新数据。' : (draft ? '已恢复本机草稿，请核对后提交。' : ''), conflict, uncertain: !!(draft && draft.uncertain) })
    } catch (error) { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ error: error.message || '加载失败，请重试' }) }
    finally { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ loading: false }) }
  },
  saveDraft() {
    if (!this.draftKey || !sameSession(this.session, wx.getStorageSync('yc_session')) || this.destroyed) return
    const user = this.data.users[this.data.userIndex]
    wx.setStorageSync(this.draftKey, { revision: this.revision, userId: user && user.value, items: this.data.items, uncertain: this.data.uncertain })
  },
  changeUser(event) { const index = Number(event.detail.value); if (!this.data.users[index]) return; this.setData({ userIndex: index }); this.saveDraft() },
  inputAmount(event) {
    const index = Number(event.currentTarget.dataset.index)
    if (!this.data.items[index]) return
    this.setData({ ['items[' + index + '].salesAmount']: event.detail.value })
    this.saveDraft()
  },
  retry() { if (!this.data.loading && !this.data.busy) this.load() },
  async submit() {
    if (this.data.busy || this.data.uncertain || this.data.conflict || !this.data.items.length) return
    const session = wx.getStorageSync('yc_session'), user = this.data.users[this.data.userIndex]
    if (!sameSession(this.session, session)) { this.setData({ error: '账号已切换，请返回重新进入' }); return }
    if (!user) { this.setData({ error: '请选择校对人员' }); return }
    if (this.data.items.some(item => item.activityId == null || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(item.salesAmount))) { this.setData({ error: '请为每项填写非负金额，最多两位小数' }); return }
    const data = this.data.items.map(item => ({ activityId: item.activityId, salesAmount: item.salesAmount, deptId: this.deptId, userId: user.value }))
    this.setData({ busy: true, error: '', notice: '' })
    try {
      await request('/sport/wx/activity/safe-submit', { method: 'POST', data: { deptId: this.deptId, revision: this.revision, items: data }, header: operatingDay.header(this, auth(session)) })
      if (!sameSession(this.session, wx.getStorageSync('yc_session'))) return
      wx.removeStorageSync(this.draftKey)
      this.setData({ notice: '提交成功', uncertain: false })
      wx.showToast({ title: '提交成功', icon: 'success' }); await this.load()
    } catch (error) {
      if (!sameSession(this.session, wx.getStorageSync('yc_session'))) return
      if ([10086,400,401,403].includes(error.code)) this.setData({ error: error.message || '提交失败，请检查后重试', conflict: error.code === 10086 && /已变化/.test(error.message || '') })
      else this.setData({ error: '提交结果未确认，请先核对当天记录，避免重复提交。', uncertain: true })
      this.saveDraft()
    } finally { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ busy: false }) }
  },
  reloadLatest() { wx.showModal({ title: '加载最新数据', content: '将清除本机草稿，请先记录需要保留的内容。确定继续吗？', success: res => { if (res.confirm) { wx.removeStorageSync(this.draftKey); this.load() } } }) },
  confirmChecked() {
    wx.showModal({ title: '核对提交结果', content: '请先通过其他方式核对当天记录。确认已核对后，才可再次提交。', success: res => {
      if (res.confirm) { this.setData({ uncertain: false, error: '', notice: '请核对金额后提交。' }); this.saveDraft() }
    } })
  }
})
