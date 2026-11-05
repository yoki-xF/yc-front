const operatingDay = require('../../utils/operating-day')
const { request, sameSession } = require('../../utils/request')
function auth(s) { return { Authorization: 'Bearer ' + s.accessToken, 'tenant-id': String(s.tenantId) } }
function amount(value) { return /^-?(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(String(value)) }
const countFields = ['hskCount', 'zfbCount', 'szRmbCount', 'wxBalanceCount']
function count(value) { return value === '' || /^\d{1,8}$/.test(String(value)) }
Page({
  data: { deptName: '', loading: true, busy: false, error: '', notice: '', uncertain: false, conflict: false, existing: false, ready: false, xj: '', wxBalance: '', hsk: '', hskCount: '', zfbCount: '', szRmbCount: '', wxBalanceCount: '', zfb: '', szRmb: '' },
  onLoad(options) {
    this.session = wx.getStorageSync('yc_session')
    this.deptId = String(options.deptId || '')
    this.userId = String(options.userId || '')
    this.setData({ deptName: options.deptName ? decodeURIComponent(options.deptName) : '' })
    if (!this.session || !this.deptId || !this.userId) { this.setData({ loading: false, error: '登录或门店信息已失效，请返回重新进入' }); return }
    this.load()
  },
  onUnload() { this.destroyed = true },
  current() {
    const day = this.operatingDay
    return !this.destroyed && sameSession(this.session, wx.getStorageSync('yc_session')) &&
      (!day || (String(this.deptId) === day.deptId && String(this.userId) === day.userId))
  },
  async load() {
    const session = wx.getStorageSync('yc_session')
    if (!this.current()) return
    this.setData({ loading: true, error: '' })
    try {
      await operatingDay.bind(this, 'yc_fund')
      if (!this.current()) return
      const result = await request('/sport/wx/night/count/fund/safe-item', { data: { deptId: this.deptId }, header: operatingDay.header(this, auth(session)) })
      if (!this.current()) return
      if (!result || !result.revision) throw Error('资金数据不完整，请重试')
      const row = result.record || {}, draft = wx.getStorageSync(this.draftKey)
      this.revision = draft ? draft.revision : result.revision
      const conflict = !!draft && draft.revision !== result.revision
      const value = key => String(draft ? (draft[key] == null ? '' : draft[key]) : (row[key] == null ? '' : row[key]))
      this.setData({ ready: true, xj: value('xj'), wxBalance: value('wxBalance'), hsk: value('hsk'), hskCount: value('hskCount'), zfbCount: value('zfbCount'), szRmbCount: value('szRmbCount'), wxBalanceCount: value('wxBalanceCount'), zfb: value('zfb'), szRmb: value('szRmb'), existing: !!row.id, uncertain: !!(draft && draft.uncertain), conflict, notice: conflict ? '资金已变化，草稿仍保存在本机，请记录后加载最新数据。' : (draft ? '已恢复本机草稿，请核对后提交。' : '') })
    } catch (error) {
      if (this.current()) this.setData({ error: error.message || '加载失败，请重试' })
    } finally {
      if (this.current()) this.setData({ loading: false })
    }
  },
  saveDraft() {
    if (!this.draftKey || !this.current()) return
    const { xj, wxBalance, hsk, zfb, szRmb, hskCount, zfbCount, szRmbCount, wxBalanceCount, uncertain } = this.data
    wx.setStorageSync(this.draftKey, { revision: this.revision, xj, wxBalance, hsk, zfb, szRmb, hskCount, zfbCount, szRmbCount, wxBalanceCount, uncertain })
  },
  input(event) {
    if (!this.current()) return
    const field = event.currentTarget.dataset.field
    if (!['xj', 'wxBalance', 'hsk', 'zfb', 'szRmb', ...countFields].includes(field)) return
    this.setData({ [field]: event.detail.value })
    this.saveDraft()
  },
  retry() { if (!this.data.loading && !this.data.busy) this.load() },
  async submit() {
    if (this.data.busy || this.data.uncertain || this.data.conflict) return
    if (!this.current() || !this.operatingDay || !this.data.ready) return
    if (![this.data.xj,this.data.wxBalance,this.data.hsk,this.data.zfb,this.data.szRmb].every(amount) || !countFields.every(key => count(this.data[key]))) { this.setData({ error: '请填写五类资金金额（最多两位小数），笔数须为非负整数。' }); return }
    const confirmed = await new Promise(resolve => wx.showModal({
      title: '提交资金盘点',
      content: this.data.existing ? '当天已有资金盘点，提交将替换原记录并更新资金余额。请核对后继续。' : '提交将更新门店资金余额，请确认金额无误。',
      success: result => resolve(this.current() && result.confirm),
      fail: () => resolve(false)
    }))
    if (!confirmed || this.data.busy || !this.current()) return
    const data = { deptId: this.deptId, xj: this.data.xj, wxBalance: this.data.wxBalance, hsk: this.data.hsk, zfb: this.data.zfb, szRmb: this.data.szRmb }
    countFields.forEach(key => { if (this.data[key] !== '') data[key] = Number(this.data[key]) })
    this.setData({ busy: true, error: '', notice: '' })
    try {
      await request('/sport/wx/night/count/fund/safe-submit', { method: 'POST', data: { deptId: this.deptId, revision: this.revision, record: data }, header: operatingDay.header(this, auth(wx.getStorageSync('yc_session'))) })
      if (!this.current()) return
      wx.removeStorageSync(this.draftKey)
      this.setData({ notice: '提交成功', existing: true })
      wx.showToast({ title: '提交成功', icon: 'success' })
      await this.load()
    } catch (error) {
      if (!this.current()) return
      if ([10086, 400, 401, 403].includes(error.code)) {
        this.setData({ error: error.message || '提交失败，请检查后重试', conflict: error.code === 10086 && /已变化/.test(error.message || '') })
      } else {
        this.setData({ error: '提交结果未确认，请先核对当天记录和资金余额，避免重复提交。', uncertain: true })
      }
      this.saveDraft()
    } finally {
      if (this.current()) this.setData({ busy: false })
    }
  },
  reloadLatest() {
    if (!this.current()) return
    wx.showModal({
      title: '加载最新数据',
      content: '将清除本机草稿，请先记录需要保留的内容。确定继续吗？',
      success: result => {
        if (!result.confirm || !this.current()) return
        wx.removeStorageSync(this.draftKey)
        this.load()
      }
    })
  },
  confirmChecked() {
    if (!this.current()) return
    wx.showModal({
      title: '核对提交结果',
      content: '请先通过其他方式核对当天记录和资金余额。确认已核对后，才可再次提交。',
      success: result => {
        if (!result.confirm || !this.current()) return
        this.setData({ uncertain: false, error: '', notice: '请核对资金后提交。' })
        this.saveDraft()
      }
    })
  }
})
