const operatingDay = require('../../utils/operating-day')
const { request, sameSession } = require('../../utils/request')
const auth = s => ({ Authorization: 'Bearer ' + s.accessToken, 'tenant-id': String(s.tenantId) })
const makeRequestKey = () => 'cash_' + Date.now().toString(36) + '_' + Array.from({length: 4}, () => Math.random().toString(36).slice(2, 10)).join('')
const validAmount = value => /^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(value) && Number(value) > 0
function formatTime(value) {
  if (!value) return '—'
  const date = new Date(value); if (Number.isNaN(date.getTime())) return String(value)
  const pad = n => String(n).padStart(2, '0')
  return [date.getFullYear(), pad(date.getMonth()+1), pad(date.getDate())].join('-') + ' ' + [pad(date.getHours()), pad(date.getMinutes())].join(':')
}
Page({
  data: { loading: true, loaded: false, busy: false, error: '', notice: '', amount: '', remark: '', uncertain: false, records: [] },
  onLoad(options) {
    this.session = wx.getStorageSync('yc_session'); this.deptId = String(options.deptId || ''); this.userId = String(options.userId || '')
    this.setData({ deptName: options.deptName ? decodeURIComponent(options.deptName) : '' })
    if (!this.session || !this.deptId || !this.userId) { this.setData({ loading: false, error: '登录或门店信息已失效，请返回重新进入' }); return }
    this.load()
  },
  onUnload() { this.destroyed = true; this.version = (this.version || 0) + 1 },
  current() { return !this.destroyed && (!this.operatingDay || (String(this.deptId) === this.operatingDay.deptId && String(this.userId) === this.operatingDay.userId)) && sameSession(this.session, wx.getStorageSync('yc_session')) },
  saveDraft() { if (this.current()) wx.setStorageSync(this.draftKey, { amount: this.data.amount, remark: this.data.remark, uncertain: this.data.uncertain, requestKey: this.requestKey || null }) },
  async load() {
    if (!this.current()) { this.setData({ loading: false, error: '账号已切换，请返回重新进入' }); return }
    const version = this.version = (this.version || 0) + 1
    this.setData({ loading: true, error: '' })
    try {
      await operatingDay.bind(this, 'yc_cash_transfer')
      const draft = wx.getStorageSync(this.draftKey)
      if (draft && !this.draftRestored) { this.draftRestored = true; this.requestKey = draft.requestKey || null; this.setData({ amount: draft.amount || '', remark: draft.remark || '', uncertain: !!draft.uncertain, notice: '已恢复本机草稿，请核对后提交。' }) }
      const records = await request('/sport/wx/shift/to/amount', { data: { deptId: this.deptId }, header: operatingDay.header(this, auth(wx.getStorageSync('yc_session'))) })
      if (!Array.isArray(records)) throw Error('流水数据不完整，请重试')
      if (version !== this.version || !this.current()) return
      this.setData({ loaded: true, records: records.map(r => ({ id: r.id, amount: r.price == null ? '—' : String(r.price), time: formatTime(r.createTime), remark: r.remark || '', userName: r.userName || '—', source: r.source === 0 ? '备用金申请' : r.source === 1 ? '其他门店转入' : r.source === 3 ? '其他' : '未知来源' })) })
    } catch (e) { if (version === this.version && this.current()) this.setData({ error: e.message || '读取流水失败，请重试' }) }
    finally { if (version === this.version && this.current()) this.setData({ loading: false }) }
  },
  retry() { if (!this.data.loading && !this.data.busy) this.load() },
  input(e) { const key=e.currentTarget.dataset.key; if (!['amount','remark'].includes(key) || this.data.busy || this.data.uncertain) return; const update = { [key]: e.detail.value }; if (!this.data.uncertain && (this.data.error.startsWith('请输入') || this.data.error.startsWith('备注不能'))) update.error = ''; this.setData(update); this.saveDraft() },
  async submit(retryPending = false) {
    if (typeof retryPending !== 'boolean') retryPending = false
    if (this.data.busy || (this.data.uncertain && !retryPending) || this.data.loading || !this.data.loaded || (this.data.error && !retryPending) || !this.current()) return
    if (!validAmount(this.data.amount)) { this.setData({ error: '请输入大于零且最多两位小数的转入金额。' }); return }
    if (this.data.remark.length > 300) { this.setData({ error: '备注不能超过 300 字。' }); return }
    const amount = this.data.amount, remark = this.data.remark
    const confirmed = await new Promise(resolve => wx.showModal({ title: '确认备付金转入', content: '转入 ' + amount + ' 元至' + this.data.deptName + '，提交后将增加该门店现金余额。', success: r => resolve(r.confirm), fail: () => resolve(false) }))
    if (!confirmed || this.data.busy || !this.current() || amount !== this.data.amount || remark !== this.data.remark) return
    if (retryPending && !this.requestKey) { this.setData({ error: '旧版待确认请求没有安全标识，请先核对流水和余额。' }); return }
    if (!this.requestKey) this.requestKey = makeRequestKey()
    this.setData({ busy: true, uncertain: true, error: '', notice: '' }); this.saveDraft()
    try {
      await request('/sport/wx/shift/to/amount/safe-submit', { method: 'POST', data: { requestKey: this.requestKey, transfer: { deptId: this.deptId, shiftSource: 0, shiftAmount: amount, remark } }, header: operatingDay.header(this, auth(wx.getStorageSync('yc_session'))) })
      if (!this.current()) return
      wx.removeStorageSync(this.draftKey); this.requestKey = null; this.setData({ amount: '', remark: '', uncertain: false, notice: '转入成功，已更新门店现金余额。' }); wx.showToast({ title: '转入成功', icon: 'success' })
      await this.load()
    } catch (e) { if (this.current()) { this.setData({ uncertain: true, error: '提交结果未确认，可使用原请求安全重试；原输入已保留。' }); this.saveDraft() } }
    finally { if (this.current()) this.setData({ busy: false }) }
  },
  retryPending() { if (!this.requestKey) { this.setData({ error: '旧版待确认请求没有安全标识，请核对流水和余额后联系管理员处理。' }); return } this.setData({ error: '' }); this.submit(true) }
})
