const operatingDay = require('../../utils/operating-day')
const { request, sameSession } = require('../../utils/request')
function auth(s) { return { Authorization: 'Bearer ' + s.accessToken, 'tenant-id': String(s.tenantId) } }
function cents(value) {
  const str = String(value == null ? '' : value)
  if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(str)) return null
  const parts = str.split('.')
  return Number(parts[0]) * 100 + Number((parts[1] || '').padEnd(2, '0'))
}
function quantity(value) { const s = String(value == null ? '' : value); return /^\d{1,6}$/.test(s) ? Number(s) : null }
function money(value) { return (value / 100).toFixed(2) }
function inventory(items, packageKey, sheetKey) {
  let total = 0
  for (const item of items) {
    const unit = cents(item.money), packPrice = cents(item.price), packages = quantity(item[packageKey]), sheets = quantity(item[sheetKey])
    if ([unit, packPrice, packages, sheets].some(v => v === null)) return null
    total += unit * sheets + packPrice * packages
    if (!Number.isSafeInteger(total)) return null
  }
  return total
}
Page({
  data: { deptName: '', loading: true, busy: false, error: '', notice: '', users: [], userIndex: -1, materials: [], materialIndex: -1, items: [], cash: '', wxBalance: '', hsk: '', zfb: '', szRmb: '', fundsLocked: false, countLocked: false, remark: '', total: '—', inventoryDiff: '—', cashDiff: '—', uncertain: false, conflict: false, existing: false, baseMissing: false },
  onLoad(options) {
    this.session = wx.getStorageSync('yc_session'); this.deptId = String(options.deptId || ''); this.userId = String(options.userId || '')
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
      await operatingDay.bind(this, 'yc_morning')
      const [result, users, materials] = await Promise.all([
        request('/sport/wx/early/count/data', { data: { deptId: this.deptId }, header: operatingDay.header(this, auth(session)) }),
        request('/sport/wx/store/active-staff', { data: { deptId: this.deptId }, header: auth(session) }),
        request('/sport/wx/common/material/List', { header: auth(session) })
      ])
      if (!sameSession(this.session, wx.getStorageSync('yc_session')) || this.destroyed || String(this.deptId) !== this.operatingDay.deptId || String(this.userId) !== this.operatingDay.userId) return
      if (!result || !result.revision || !result.morningFunds || typeof result.morningFunds.locked !== 'boolean' || !result.zchCheckGgl || !Array.isArray(result.materialVOList) || !Array.isArray(result.zchInventoryGglList)) throw Error('盘点数据不完整，请稍后重试')
      this.base = result; const row = result.zchCheckGgl, draft = wx.getStorageSync(this.draftKey)
      this.revision = draft ? draft.revision : result.revision
      const conflict = !!draft && draft.revision !== result.revision
      const list = (Array.isArray(users) ? users : []).filter(u => u && u.value != null && u.label)
      const chosen = draft ? draft.userId : (row.checkUserId || this.userId)
      const items = (draft && Array.isArray(draft.items) ? draft.items : result.materialVOList).map(item => Object.assign({}, item, { invPackageNum: String(item.invPackageNum == null ? '' : item.invPackageNum), invZhangNum: String(item.invZhangNum == null ? '' : item.invZhangNum) }))
      const fundField = (key, serverKey) => String(draft && !result.morningFunds.locked ? (draft[key] == null ? '' : draft[key]) : (result.morningFunds[serverKey] == null ? '' : result.morningFunds[serverKey]))
      const field = (key, serverKey) => String(draft ? (draft[key] == null ? '' : draft[key]) : (row[serverKey] == null ? '' : row[serverKey]))
      this.setData({ users: list, userIndex: list.findIndex(u => String(u.value) === String(chosen)), materials: Array.isArray(materials) ? materials : [], items, cash: fundField('cash','xj'), wxBalance: fundField('wxBalance','wxBalance'), hsk: fundField('hsk','hsk'), zfb: fundField('zfb','zfb'), szRmb: fundField('szRmb','szRmb'), fundsLocked: result.morningFunds.locked, countLocked: !!row.id && !!result.morningFunds.started, remark: field('remark','remark'), existing: !!row.id, uncertain: !!(draft && draft.uncertain), conflict, notice: conflict ? '数据已变化，草稿仍保存在本机，请记录内容后加载最新数据。' : (draft ? '已恢复本机草稿，请核对后提交。' : ''), baseMissing: !result.zchInventoryFund || result.zchInventoryFund.xj == null })
      this.recalculate()
    } catch (error) { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ error: error.message || '加载失败，请重试' }) }
    finally { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ loading: false }) }
  },
  recalculate() {
    const total = inventory(this.data.items, 'invPackageNum', 'invZhangNum')
    const base = this.base ? inventory(this.base.zchInventoryGglList, 'packageNum', 'sheetNum') : null
    const cash = cents(this.data.cash), prior = this.base && this.base.zchInventoryFund ? cents(this.base.zchInventoryFund.xj) : null
    this.setData({ total: total === null ? '—' : money(total), inventoryDiff: total === null || base === null ? '—' : money(total - base), cashDiff: cash === null || prior === null ? '—' : money(cash - prior) })
  },
  saveDraft() { if (!this.draftKey || !sameSession(this.session, wx.getStorageSync('yc_session')) || this.destroyed) return; const user = this.data.users[this.data.userIndex]; wx.setStorageSync(this.draftKey, { revision: this.revision, userId: user && user.value, items: this.data.items, cash: this.data.cash, wxBalance: this.data.wxBalance, hsk: this.data.hsk, zfb: this.data.zfb, szRmb: this.data.szRmb, remark: this.data.remark, uncertain: this.data.uncertain }) },
  input(event) { const field = event.currentTarget.dataset.field; if (this.data.fundsLocked && field !== 'remark') return; if (!['cash','wxBalance','hsk','zfb','szRmb','remark'].includes(field)) return; this.setData({ [field]: event.detail.value }); this.recalculate(); this.saveDraft() },
  inputItem(event) { const index = Number(event.currentTarget.dataset.index), field = event.currentTarget.dataset.field; if (!this.data.items[index] || !['invPackageNum','invZhangNum'].includes(field)) return; this.setData({ ['items['+index+'].'+field]: event.detail.value }); this.recalculate(); this.saveDraft() },
  changeUser(event) { const index = Number(event.detail.value); if (!this.data.users[index]) return; this.setData({ userIndex: index }); this.saveDraft() },
  addMaterial(event) {
    const index = Number(event.detail.value), item = this.data.materials[index]
    if (!item || this.data.items.some(x => String(x.materialId) === String(item.id))) { wx.showToast({ title: '该票种已存在', icon: 'none' }); return }
    this.setData({ items: this.data.items.concat([{ materialId: item.id, materialName: item.materialName, money: item.money, price: item.price, invPackageNum: '0', invZhangNum: '0', deptId: this.deptId }]) }); this.recalculate(); this.saveDraft()
  },
  clearCounts() { wx.showModal({ title: '清空数量', content: '将所有票种的包数和张数设为零，确定继续吗？', success: res => { if (res.confirm) { this.setData({ items: this.data.items.map(item => Object.assign({}, item, { invPackageNum: '0', invZhangNum: '0' })) }); this.recalculate(); this.saveDraft() } } }) },
  retry() { if (!this.data.busy && !this.data.loading) this.load() },
  async submit() {
    if (this.data.busy || this.data.uncertain || this.data.conflict || this.data.countLocked) return
    const session = wx.getStorageSync('yc_session'), user = this.data.users[this.data.userIndex]
    if (!sameSession(this.session, session)) { this.setData({ error: '账号已切换，请返回重新进入' }); return }
    if (!user || [this.data.total, this.data.inventoryDiff, this.data.cashDiff].includes('—') || [this.data.cash,this.data.wxBalance,this.data.hsk,this.data.zfb,this.data.szRmb].some(v => cents(v) === null)) { this.setData({ error: '请检查校对人员、期初数据、金额及票据数量。' }); return }
    const confirmed = await new Promise(resolve => wx.showModal({ title: '提交早盘点', content: this.data.existing ? '当天已有早盘点，提交将替换原记录。请确认已核对。' : '请确认盘点金额和票据数量无误。', success: r => resolve(r.confirm), fail: () => resolve(false) }))
    if (!confirmed || this.data.busy || !sameSession(this.session, wx.getStorageSync('yc_session'))) return
    const fields = ['materialId','invPackageNum','invZhangNum','inventoryId','materialName','deptId','money','price','checkGglId']
    const rows = this.data.items.map(item => { const result = {}; fields.forEach(k => { if (item[k] != null) result[k] = item[k] }); return result })
    const data = { revision: this.revision, deptId: this.deptId, checkUserId: user.value, checkUserName: user.label, invCount: this.data.total, invYesterdayDiff: this.data.inventoryDiff, invCashDiff: this.data.cashDiff, morningCashDesc: this.data.cash, wxBalance: this.data.wxBalance, hsk: this.data.hsk, zfb: this.data.zfb, szRmb: this.data.szRmb, remark: this.data.remark, materialVOList: rows }
    this.setData({ busy: true, error: '', notice: '' })
    try {
      const latest = wx.getStorageSync('yc_session'); await request('/sport/wx/early/count/safe-submit', { method: 'POST', data, header: operatingDay.header(this, auth(latest)) })
      if (!sameSession(this.session, wx.getStorageSync('yc_session'))) return
      wx.removeStorageSync(this.draftKey); this.setData({ notice: '提交成功', existing: true }); wx.showToast({ title: '提交成功', icon: 'success' }); await this.load()
    } catch (error) { if (sameSession(this.session, wx.getStorageSync('yc_session'))) { if ([10086, 400, 401, 403].includes(error.code)) { this.setData({ error: error.message || '提交失败，请检查后重试', conflict: error.code === 10086 && /已变化/.test(error.message || '') }); this.saveDraft() } else { this.setData({ error: '提交结果未确认，请先核对当天记录，避免重复提交。', uncertain: true }); this.saveDraft() } } }
    finally { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ busy: false }) }
  },
  reloadLatest() { wx.showModal({ title: '加载最新数据', content: '将清除本机草稿，请先记录需要保留的内容。确定继续吗？', success: res => { if (res.confirm) { wx.removeStorageSync(this.draftKey); this.load() } } }) },
  confirmChecked() { wx.showModal({ title: '核对提交结果', content: '请先通过其他方式核对当天记录。确认已核对后，才可再次提交。', success: res => { if (res.confirm) { this.setData({ uncertain: false, error: '', notice: '请核对盘点内容后提交。' }); this.saveDraft() } } }) }
})
