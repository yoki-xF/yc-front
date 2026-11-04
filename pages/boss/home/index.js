const api = require('../../../utils/boss/api')
const {visible:adminVisible}=require('../../../utils/admin-entries')
const { resources, can } = require('../../../utils/boss/resources')
Page({
  data: { loading: true, error: '', modules: [], nickname: '', reportAccess: false, availabilityNotice:'',openingAccess:false,operatingAccess:false,adminAccess:false },
  onShow() { this.session = wx.getStorageSync('yc_session'); this.version = (this.version || 0) + 1; this.load() },
  onHide() { this.version++ },
  async load() {
    const version = ++this.version
    this.setData({ loading: true, error: '', modules: [], nickname: '', reportAccess:false,availabilityNotice:'',openingAccess:false,operatingAccess:false,adminAccess:false })
    try {
      const [identityResult,capabilityResult]=await Promise.allSettled([api.identity(this.session),api.capabilities(this.session)])
      if(identityResult.status!=='fulfilled')throw identityResult.reason
      const info=identityResult.value
      if (version !== this.version) return
      const modules = Object.keys(resources).filter(key => can(info.permissions, resources[key].permission)).map(key => ({ key, title: resources[key].title }))
      const hasReportPermission=can(info.permissions,'sport:check-ggl:query')||can(info.permissions,'sport:check-service:query')
      const reportsEnabled=capabilityResult.status==='fulfilled'&&capabilityResult.value.reportsEnabled
      this.setData({ adminAccess:adminVisible(info).some(entry=>!entry.authOnly), modules, operatingAccess:can(info.permissions,'sport:business-day:query'), openingAccess:can(info.permissions,'sport:store-opening:create'), nickname: info.user.nickname || info.user.username || '', reportAccess:hasReportPermission&&reportsEnabled,availabilityNotice:hasReportPermission&&!reportsEnabled?(capabilityResult.status==='fulfilled'?'报表功能待账务规则验证后开放。':'暂时无法读取报表开放状态，请稍后重新进入。'):'' })
    } catch (e) { if (version === this.version) this.setData({ error: e.message || '读取失败' }) }
    finally { if (version === this.version) this.setData({ loading: false }) }
  },
  retry() { if (!this.data.loading) this.load() },
  admin(){if(this.data.adminAccess)wx.navigateTo({url:'/pages/admin/home/index'})},
  reports() { if(this.data.reportAccess)wx.navigateTo({url:'/pages/boss/reports/index'}) },
  operatingDay() { if(this.data.operatingAccess)wx.navigateTo({url:'/pages/boss/operating-day/index'}) },
  opening() { if(this.data.openingAccess)wx.navigateTo({url:'/pages/boss/opening/index'}) },
  profile() { wx.navigateTo({url:'/pages/boss/profile/index'}) },
  open(e) { const key = e.currentTarget.dataset.key; if (!this.data.modules.some(x => x.key === key)) return; wx.navigateTo({ url: '/pages/boss/records/index?type=' + encodeURIComponent(key) }) },
  login() { wx.navigateTo({ url: '/pages/login/index' }) }
})
