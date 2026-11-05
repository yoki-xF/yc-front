const api = require('../../../utils/boss/api')
const exportApi = require('../../../utils/boss/export')
const { getResource, can } = require('../../../utils/boss/resources')
const { sameSession } = require('../../../utils/request')
Page({
  data: { title: '', loading: false, ready: false, invalidEntry: false, loaded: false, error: '', rows: [], total: 0, keyword: '', start: '', end: '', searchLabel: '', pageNo: 0, canCreate: false, canCreateCommission: false, canExport: false, exporting: false, hasExport: false, depts: [], deptIndex: 0, appliedSummary: '', filtersDirty: false },
  onLoad(options = {}) {
    this.version = 0
    this.session = wx.getStorageSync('yc_session')
    this.type = options.type
    try {
      const resource = getResource(this.type)
      this.setData({ title: resource.title, searchLabel: resource.searchField ? (this.type === 'users' ? '账号' : '名称') : '' })
      wx.setNavigationBarTitle({ title: resource.title })
      this.init()
    } catch (error) { this.setData({ invalidEntry: true, error: error.message }) }
  },
  onShow() { this.hidden = false; if (this.opened && !this.data.invalidEntry) this.init(); this.opened = true },
  onHide() {
    this.hidden = true; this.version++
    this.clearExport()
    this.setData({ ready: false, loading: false, rows: [], loaded: false, canCreate: false, canCreateCommission: false, canExport: false })
  },
  onUnload() { this.disposed = true; this.version++; this.clearExport() },
  current(version) { return !this.disposed && !this.hidden && (version == null || version === this.version) && sameSession(this.session, wx.getStorageSync('yc_session')) },
  clearExport() { exportApi.unlink(this.exportPath); this.exportPath = null; this.setData({ hasExport: false }) },
  backToWorkspace() { wx.switchTab({ url: '/pages/index/index' }) },
  async init() {
    if (this.disposed || this.hidden) return
    if (!this.current()) { this.setData({ invalidEntry: true, ready: false, loading: false, error: '账号已变化，请从工作台重新进入' }); return }
    const version = ++this.version
    this.clearExport()
    this.setData({ loading: true, ready: false, loaded: false, error: '', rows: [], total: 0, canCreate: false, canCreateCommission: false, canExport: false })
    try {
      const resource = getResource(this.type)
      const [depts, identity] = await Promise.all([
        resource.dept ? api.options(this.session) : [],
        this.type === 'commission' ? api.identity(this.session) : null
      ])
      if (!this.current(version)) return
      const previous = this.data.depts[this.data.deptIndex]
      const options = resource.dept ? [{ id: '', name: '全部可见门店' }, ...depts] : []
      const selected = previous ? options.findIndex(dept => String(dept.id) === String(previous.id)) : 0
      this.setData({ depts: options, deptIndex: Math.max(0, selected), ready: true, loading: false, canCreateCommission: !!identity && can(identity.permissions, 'sport:check-game-sales:create') })
      await this.load(true)
    } catch (error) {
      if (this.current(version)) this.setData({ loading: false, error: error.message || '读取门店失败，请重试' })
    } finally { this.checkSession(version) }
  },
  checkSession(version) {
    if (version === this.version && !this.disposed && !this.hidden && !this.current()) {
      this.clearExport()
      this.setData({ invalidEntry: true, loading: false, ready: false, loaded: false, rows: [], total: 0, canCreate: false, canCreateCommission: false, canExport: false, error: '账号已变化，请从工作台重新进入' })
    }
  },
  department(event) { const index = Number(event.detail.value); if (this.data.depts[index] && !this.data.loading) this.setData({ deptIndex: index, filtersDirty: true }) },
  commissionCreate() { if (this.current() && this.data.ready && this.data.canCreateCommission) wx.navigateTo({ url: '/pages/boss/commission-create/index' }) },
  create() { if (this.current() && this.data.ready && this.data.canCreate) wx.navigateTo({ url: this.type === 'attendance' ? '/pages/boss/schedule/index' : '/pages/boss/form/index?type=' + encodeURIComponent(this.type) }) },
  input(event) { if (!this.data.loading) this.setData({ keyword: event.detail.value, filtersDirty: true }) },
  date(event) { const key = event.currentTarget.dataset.key; if (!this.data.loading && ['start', 'end'].includes(key)) this.setData({ [key]: event.detail.value, filtersDirty: true }) },
  search() { if (!this.data.loading && !this.data.invalidEntry) { if (!this.data.ready) this.init(); else this.load(true) } },
  clear() { if (this.data.loading) return; this.setData({ keyword: '', start: '', end: '', deptIndex: 0, filtersDirty: true }); this.search() },
  more() { if (!this.data.loading && this.data.loaded && this.data.rows.length < this.data.total) this.load(false) },
  async load(reset) {
    if (this.data.loading || !this.data.ready || !this.current()) { this.checkSession(this.version); return }
    const version = ++this.version, pageNo = reset ? 1 : this.data.pageNo + 1
    if (reset) this.clearExport()
    this.setData({ loading: true, error: '', ...(reset ? { rows: [], total: 0, loaded: false, pageNo: 0, canCreate: false, canExport: false } : {}) })
    try {
      // Pagination and exports use the submitted filters, not unsaved edits.
      if (reset) {
        const dept = this.data.depts[this.data.deptIndex]
        this.filters = { keyword: this.data.keyword, start: this.data.start, end: this.data.end, deptId: dept && dept.id }
        this.setData({ filtersDirty: false, appliedSummary: [dept && dept.name, this.data.start ? this.data.start + ' 至 ' + this.data.end : '全部日期', this.data.keyword ? this.data.searchLabel + '：' + this.data.keyword : ''].filter(Boolean).join(' · ') })
      }
      const result = await api.list(this.session, this.type, this.filters, pageNo)
      if (!this.current(version)) return
      this.setData({ rows: reset ? result.rows : this.data.rows.concat(result.rows), total: result.total, pageNo, loaded: true, canCreate: !!result.canCreate, canExport: !!result.canExport })
    } catch (error) { if (this.current(version)) this.setData({ error: error.message || '读取失败' }) }
    finally { if (this.current(version)) this.setData({ loading: false }); this.checkSession(version) }
  },
  async exportCsv() {
    if (this.data.loading || this.data.exporting || !this.data.loaded || !this.data.canExport || !this.current()) return
    const version = this.version
    this.setData({ exporting: true, error: '' })
    let path
    try {
      path = await exportApi.download(this.session, this.type, this.filters || {})
      if (!this.current(version)) { exportApi.unlink(path); return }
      this.clearExport(); this.exportPath = path
      this.setData({ hasExport: true })
    } catch (error) { exportApi.unlink(path); if (this.current(version)) this.setData({ error: error.message || '导出失败' }) }
    finally { if (!this.disposed) this.setData({ exporting: false }); this.checkSession(version) }
  },
  shareCsv() {
    if (!this.current() || !this.exportPath || !this.data.hasExport) return
    wx.shareFileMessage({ filePath: this.exportPath, fileName: this.type + '.csv', fail: () => { if (this.current()) this.setData({ error: '文件未发送，可重新操作' }) } })
  },
  open(event) {
    if (!this.current() || !this.data.ready) return
    const row = this.data.rows[Number(event.currentTarget.dataset.index)]
    if (row && row.canOpen) wx.navigateTo({ url: '/pages/boss/detail/index?type=' + encodeURIComponent(this.type) + '&id=' + encodeURIComponent(row.id) })
  }
})
