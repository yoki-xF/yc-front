const api = require('../../utils/boss/api')
const {visible:adminVisible}=require('../../utils/admin-entries')
const { resources, can } = require('../../utils/boss/resources')
Component({
  data: { visible: false },
  lifetimes: { attached() { this.check() }, detached() { this.version = (this.version || 0) + 1 } },
  pageLifetimes: { show() { this.check() }, hide() { this.version = (this.version || 0) + 1 } },
  methods: {
    async check() {
      const version = this.version = (this.version || 0) + 1, session = wx.getStorageSync('yc_session')
      this.setData({ visible: false })
      if (!session) return
      try { const info = await api.identity(session); if (version === this.version) this.setData({ visible: adminVisible(info).some(entry=>!entry.authOnly) || Object.values(resources).some(r => can(info.permissions, r.permission)) || can(info.permissions,'sport:business-day:query') || can(info.permissions,'sport:store-opening:create') }) }
      catch (_) { /* 不影响员工工作台；老板页再次校验权限并给出错误。 */ }
    },
    open() { if (this.data.visible) wx.navigateTo({ url: '/pages/boss/home/index' }) }
  }
})
