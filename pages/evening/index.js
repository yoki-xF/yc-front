const operatingDay = require('../../utils/operating-day')
const { request, sameSession } = require('../../utils/request')
function auth(s) { return { Authorization: 'Bearer ' + s.accessToken, 'tenant-id': String(s.tenantId) } }
function cents(v) { const s = String(v == null ? '' : v); if (!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,2})?$/.test(s)) return null; const p = s.split('.'); return Number(p[0]) * 100 + Number((p[1] || '').padEnd(2, '0')) }
function quantity(v) { const s = String(v == null ? '' : v); return /^\d{1,6}$/.test(s) ? Number(s) : null }
Page({
  data: { deptName: '', loading: true, busy: false, error: '', notice: '', uncertain: false, conflict: false, items: [], materials: [], total: '—', packages: '—', sheets: '—' },
  onLoad(options) {
    this.session = wx.getStorageSync('yc_session'); this.deptId = String(options.deptId || ''); this.userId = String(options.userId || '')
    this.setData({ deptName: options.deptName ? decodeURIComponent(options.deptName) : '' })
    if (!this.session || !this.deptId || !this.userId) { this.setData({ loading: false, error: '登录或门店信息已失效，请返回重新进入' }); return }
    this.load()
  },
  onUnload() { this.destroyed = true },
  async load(discardDraft = false) {
    const session = wx.getStorageSync('yc_session')
    if (!sameSession(this.session, session)) { this.setData({ loading: false, error: '账号已切换，请返回重新进入' }); return }
    this.setData({ loading: true, error: '' })
    try {
      await operatingDay.bind(this, 'yc_evening')
      const [result, materials] = await Promise.all([
        request('/sport/wx/night/count/bill/data', { data: { deptId: this.deptId }, header: operatingDay.header(this, auth(session)) }),
        request('/sport/wx/common/material/List', { header: auth(session) })
      ])
      if (!sameSession(this.session, wx.getStorageSync('yc_session')) || this.destroyed || String(this.deptId) !== this.operatingDay.deptId || String(this.userId) !== this.operatingDay.userId) return
      if (!result || !Array.isArray(result.materialVOList) || !result.revision) throw Error('盘点数据或库存版本不完整，请稍后重试')
      const draft = !discardDraft && wx.getStorageSync(this.draftKey)
      const conflict = !!(draft && draft.revision !== result.revision)
      this.revision = draft ? draft.revision : result.revision
      const items = (draft && Array.isArray(draft.items) ? draft.items : result.materialVOList).map(item => Object.assign({}, item, { invPackageNum: String(item.invPackageNum == null ? '' : item.invPackageNum), invZhangNum: String(item.invZhangNum == null ? '' : item.invZhangNum) }))
      this.setData({ items, materials: Array.isArray(materials) ? materials : [], uncertain: !!(draft && draft.uncertain), conflict, notice: conflict ? '库存或盘点记录已变化，本机草稿已保留。请核对后选择是否加载最新数据。' : draft ? '已恢复本机草稿，请核对库存后提交。' : '' }); if (discardDraft) wx.removeStorageSync(this.draftKey); this.recalculate()
    } catch (error) { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ error: error.message || '加载失败，请重试' }) }
    finally { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ loading: false }) }
  },
  recalculate() {
    let total = 0, packages = 0, sheets = 0, valid = true
    for (const item of this.data.items) {
      const unit = cents(item.money), price = cents(item.price), pack = quantity(item.invPackageNum), count = quantity(item.invZhangNum)
      if ([unit,price,pack,count].some(v => v === null)) { valid = false; break }
      total += unit * count + price * pack; packages += pack; sheets += count
      if (![total, packages, sheets].every(Number.isSafeInteger)) { valid = false; break }
    }
    this.setData({ total: valid ? (total / 100).toFixed(2) : '—', packages: valid ? String(packages) : '—', sheets: valid ? String(sheets) : '—' })
  },
  saveDraft() { if (sameSession(this.session, wx.getStorageSync('yc_session'))) wx.setStorageSync(this.draftKey, { items: this.data.items, uncertain: this.data.uncertain, revision: this.revision }) },
  inputItem(event) { const index = Number(event.currentTarget.dataset.index), field = event.currentTarget.dataset.field; if (this.data.busy || this.data.conflict || !this.data.items[index] || !['invPackageNum','invZhangNum'].includes(field)) return; this.setData({ ['items[' + index + '].' + field]: event.detail.value }); this.recalculate(); this.saveDraft() },
  addMaterial(event) {
    if (this.data.busy || this.data.conflict) return
    const item = this.data.materials[Number(event.detail.value)]
    if (!item || this.data.items.some(x => String(x.materialId) === String(item.id))) { wx.showToast({ title: '该票种已存在', icon: 'none' }); return }
    this.setData({ items: this.data.items.concat([{ materialId: item.id, materialName: item.materialName, money: item.money, price: item.price, invPackageNum: '0', invZhangNum: '0', deptId: this.deptId }]) }); this.recalculate(); this.saveDraft()
  },
  clearCounts() { if (this.data.busy || this.data.conflict) return; wx.showModal({ title: '清空数量', content: '将所有票种的包数和张数设为零，确定继续吗？', success: res => { if (res.confirm) { this.setData({ items: this.data.items.map(item => Object.assign({}, item, { invPackageNum: '0', invZhangNum: '0' })) }); this.recalculate(); this.saveDraft() } } }) },
  retry() { if (!this.data.loading && !this.data.busy) this.load() },
  reloadLatest() { if (this.data.loading || this.data.busy) return; wx.showModal({ title: '加载最新盘点数据', content: '加载最新数据会放弃本机盘点草稿，请先记录需要保留的内容。确定继续吗？', success: res => { if (res.confirm && sameSession(this.session, wx.getStorageSync('yc_session'))) this.load(true) } }) },
  async submit() {
    if (this.data.busy || this.data.loading || this.data.uncertain || this.data.conflict || !this.revision) return
    if (!sameSession(this.session, wx.getStorageSync('yc_session'))) { this.setData({ error: '账号已切换，请返回重新进入' }); return }
    if (this.data.total === '—') { this.setData({ error: '请检查票据价格及数量，数量应为非负整数。' }); return }
    const confirmed = await new Promise(resolve => wx.showModal({ title: '提交晚盘点', content: '提交会更新门店票据库存，并替换当天已有的晚盘点。请核对全部票种及数量。', success: res => resolve(res.confirm), fail: () => resolve(false) }))
    if (!confirmed || this.data.busy || !sameSession(this.session, wx.getStorageSync('yc_session'))) return
    const fields = ['materialId','inventoryId','invPackageNum','invZhangNum','materialName','deptId','money','price']
    const rows = this.data.items.map(item => { const result = {}; fields.forEach(k => { if (item[k] != null) result[k] = item[k] }); return result })
    this.setData({ busy: true, error: '', notice: '' })
    try {
      await request('/sport/wx/night/count/bill/safe-submit', { method: 'POST', data: { deptId: this.deptId, revision: this.revision, materialVOList: rows }, header: operatingDay.header(this, auth(wx.getStorageSync('yc_session'))) })
      if (!sameSession(this.session, wx.getStorageSync('yc_session'))) return
      wx.removeStorageSync(this.draftKey); await this.load(true); if (sameSession(this.session, wx.getStorageSync('yc_session'))) { this.setData({ notice: '提交成功，请核对最新记录。' }); wx.showToast({ title: '提交成功', icon: 'success' }) }
    } catch (error) {
      if (sameSession(this.session, wx.getStorageSync('yc_session'))) { if ([10086,401,403].includes(error.code)) this.setData({ error: error.message || '提交失败，请核对后重试。', conflict: error.code === 10086 && /库存或盘点记录已变化/.test(error.message || '') }); else this.setData({ error: '提交结果未确认，请先核对当天记录和库存，避免重复提交。', uncertain: true }); this.saveDraft() }
    } finally { if (sameSession(this.session, wx.getStorageSync('yc_session'))) this.setData({ busy: false }) }
  },
  confirmChecked() { wx.showModal({ title: '核对提交结果', content: '请先通过其他方式核对当天记录和库存。确认已核对后，才可再次提交。', success: res => { if (res.confirm) { this.setData({ uncertain: false, error: '', notice: '请核对库存后提交。' }); this.saveDraft() } } }) }
})
