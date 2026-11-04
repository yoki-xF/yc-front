const api = require('../../../utils/boss/api')
const exportApi=require('../../../utils/boss/export')
const { getResource } = require('../../../utils/boss/resources')
Page({
  data: { title: '', loading: false, loaded: false, error: '', rows: [], total: 0, keyword: '', start: '', end: '', searchLabel: '', pageNo: 0, canCreate: false, depts: [], deptIndex: 0 },
  onLoad(o) {
    this.version = 0; this.session = wx.getStorageSync('yc_session'); this.type = o.type
    try { const r = getResource(this.type); this.setData({ title: r.title, searchLabel: r.searchField ? (this.type === 'users' ? '账号' : '名称') : '' }); wx.setNavigationBarTitle({ title: r.title }); this.init() }
    catch (e) { this.setData({ error: e.message }) }
  },
  onUnload() { this.disposed=true;this.version++;exportApi.unlink(this.exportPath) },
  onShow() { if (this.opened && !this.data.loading) this.load(true); this.opened = true },
  async init() { try { if(getResource(this.type).dept) { const depts=await api.options(this.session); if(this.disposed)return;this.setData({depts:[{id:'',name:'全部可见门店'},...depts]}) } if(!this.disposed)await this.load(true) } catch(e) { this.setData({error:e.message || '读取门店失败'}) } },
  department(e) { const index=Number(e.detail.value); if(this.data.depts[index]&&!this.data.loading)this.setData({deptIndex:index}) },
  create() { if(this.data.canCreate)wx.navigateTo({url:this.type==='attendance'?'/pages/boss/schedule/index':'/pages/boss/form/index?type='+encodeURIComponent(this.type)}) },
  input(e) { this.setData({ keyword: e.detail.value }) },
  date(e) { const key = e.currentTarget.dataset.key; if (['start', 'end'].includes(key)) this.setData({ [key]: e.detail.value }) },
  search() { if (!this.data.loading) this.load(true) },
  clear() { if (this.data.loading) return; this.setData({ keyword: '', start: '', end: '' }); this.load(true) },
  more() { if (!this.data.loading && this.data.loaded && this.data.rows.length < this.data.total) this.load(false) },
  async load(reset) {
    if (this.data.loading) return
    const version = ++this.version, pageNo = reset ? 1 : this.data.pageNo + 1
    this.setData({ loading: true, error: '', ...(reset ? { rows: [], total: 0, loaded: false, pageNo: 0 } : {}) })
    try {
      // 翻页始终使用首次查询时的筛选条件，避免混合不同查询的结果。
      if (reset) this.filters = { keyword: this.data.keyword, start: this.data.start, end: this.data.end, deptId:this.data.depts[this.data.deptIndex]&&this.data.depts[this.data.deptIndex].id }
      const result = await api.list(this.session, this.type, this.filters, pageNo)
      if (version !== this.version) return
      this.setData({ rows: reset ? result.rows : this.data.rows.concat(result.rows), total: result.total, pageNo, loaded: true, canCreate:!!result.canCreate,canExport:!!result.canExport })
    } catch (e) { if (version === this.version) this.setData({ error: e.message || '读取失败' }) }
    finally { if (version === this.version) this.setData({ loading: false }) }
  },
  async exportCsv(){if(this.data.loading||this.exportBusy||!this.data.canExport)return;this.exportBusy=true;this.setData({error:''});let path;try{path=await exportApi.download(this.session,this.type,this.filters||{});api.active(this.session);if(this.disposed){exportApi.unlink(path);return}exportApi.unlink(this.exportPath);this.exportPath=path;this.setData({hasExport:true})}catch(e){exportApi.unlink(path);if(!this.disposed)this.setData({error:e.message||'导出失败'})}finally{this.exportBusy=false}},
  shareCsv(){try{api.active(this.session);if(!this.disposed&&this.exportPath)wx.shareFileMessage({filePath:this.exportPath,fileName:this.type+'.csv',fail:()=>{if(!this.disposed)this.setData({error:'文件未发送，可重新操作'})}})}catch(e){this.setData({error:e.message})}},
  open(e) { const index = Number(e.currentTarget.dataset.index), row = this.data.rows[index]; if (!row || !row.canOpen) return; wx.navigateTo({ url: '/pages/boss/detail/index?type=' + encodeURIComponent(this.type) + '&id=' + encodeURIComponent(row.id) }) }
})
