const api = require('../../../utils/admin-infra/jobs')
const { sameSession } = require('../../../utils/request')
Page({
 data: { rows: [], loading: false, loaded: false, error: '', name: '', pageNo: 0, total: 0, busy: false, unknown: false },
 onLoad() { this.session = wx.getStorageSync('yc_session'); this.seq = 0; this.load(true) },
 onShow() { if (this.session && !sameSession(this.session, wx.getStorageSync('yc_session'))) { this.seq++; this.setData({rows:[],loaded:false,loading:false,error:'账号已变化，请重新进入'}); return } if (this.opened && !this.data.loading) this.load(true); this.opened = true },
 onUnload() { this.disposed = true; this.seq++ },
 input(e) { this.setData({ name: e.detail.value }) },
 search() { this.load(true) }, more() { this.load(false) },
 async load(reset) {
  if (this.data.loading || (!reset && this.data.rows.length >= this.data.total)) return
  const seq = ++this.seq, pageNo = reset ? 1 : this.data.pageNo + 1
  if (reset) this.filter = { name: this.data.name.trim() }
  this.setData({ loading: true, error: '' })
  try {
   const r = await api.page(this.session, { ...this.filter, pageNo, pageSize: 20 })
   if (!r || !Array.isArray(r.list) || !Number.isFinite(Number(r.total))) throw Error('列表数据不完整')
   if (seq !== this.seq) return
   const rows = r.list.map(x => ({ id: x.id, name: x.name, handlerName: x.handlerName, cronExpression: x.cronExpression, status: x.status, revision: x.revision }))
   this.setData({ rows: reset ? rows : this.data.rows.concat(rows), total: Number(r.total), pageNo, loaded: true, unknown: false })
  } catch (e) { if (seq === this.seq) this.setData({ error: e.message || '读取失败' }) }
  finally { if (seq === this.seq) this.setData({ loading: false }) }
 },
 create() { wx.navigateTo({ url: '/pages/admin-infra/job-form/index' }) },
 edit(e) { wx.navigateTo({ url: '/pages/admin-infra/job-form/index?id=' + encodeURIComponent(e.currentTarget.dataset.id) }) },
 logs(e) { wx.navigateTo({ url: '/pages/admin-infra/catalog/index?type=job-log&jobId=' + encodeURIComponent(e.currentTarget.dataset.id) }) },
 async next(e) { try { const r = await api.next(this.session, e.currentTarget.dataset.id); if (!this.disposed) wx.showModal({ title: '下次执行时间', content: Array.isArray(r) && r.length ? r.join('\n') : '暂无执行时间', showCancel: false }) } catch (err) { if (!this.disposed) wx.showToast({ title: err.message || '读取失败', icon: 'none' }) } },
 action(e) {
  if (this.data.busy || this.data.unknown) return
  const { id, action, status, revision } = e.currentTarget.dataset
  const labels = { trigger: '立即执行此任务', delete: '删除此任务', status: status === 1 ? '停止此任务' : '启用此任务' }
  if (!labels[action]) return
  wx.showModal({ title: '确认操作', content: labels[action] + '？此操作会影响任务调度。', success: async r => {
   if (!r.confirm || this.disposed || this.data.busy) return
   this.setData({ busy: true })
   try { const out = action === 'trigger' ? await api.trigger(this.session, id, revision) : action === 'delete' ? await api.remove(this.session, id, revision) : await api.status(this.session, id, status === 1 ? 2 : 1, revision); if (out !== true) { const e=Error('未取得明确操作结果，请刷新核对'); e.mayHaveWritten=true; throw e } if (!this.disposed) { wx.showToast({ title: '操作成功' }); this.load(true) } }
   catch (err) { if (!this.disposed && err.mayHaveWritten) this.setData({unknown:true}); if (!this.disposed) wx.showModal({ title: '操作未确认', content: err.mayHaveWritten ? '结果未知，请刷新核对后再操作，勿重复提交。' : (err.message || '操作失败'), showCancel: false }) }
   finally { if (!this.disposed) this.setData({ busy: false }) }
  } })
 }
})
