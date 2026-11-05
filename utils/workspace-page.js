const { request, sameSession } = require('./request')
const api = require('./boss/api')
const { resources, can } = require('./boss/resources')
const { visible } = require('./admin-entries')

function createWorkspacePage(kind) {
  const reports = kind === 'reports'
  const mine = kind === 'mine'
  function current(page) {
    return !page.destroyed && !page.hidden && !!page.session && sameSession(page.session, wx.getStorageSync('yc_session'))
  }
  function preference(page) {
    return 'yc_dept_' + page.session.tenantId + '_' + page.userId
  }
  function groups(items) {
    const result = []
    for (const item of items) {
      let group = result.find(value => value.title === item.group)
      if (!group) { group = { title: item.group, entries: [] }; result.push(group) }
      group.entries.push(item)
    }
    return result
  }
  return {
    data: { title: mine ? '我的' : reports ? '报表' : '单据与记录', description: mine ? '账号、消息与帮助，集中管理。' : reports ? '先确认范围，再查看已结店报表。' : '采购、调拨与经营记录，按权限办理。', loading: true, error: '', notice: '', signedIn: false, nickname: '', depts: [], deptIndex: -1, groups: [], items: [], showStore: !mine },
    onShow() { this.hidden = false; this.session = wx.getStorageSync('yc_session'); this.load() },
    onHide() { this.hidden = true; this.version = (this.version || 0) + 1 },
    onUnload() { this.destroyed = true; this.version = (this.version || 0) + 1 },
    async load() {
      const version = this.version = (this.version || 0) + 1
      this.setData({ loading: true, error: '', notice: '', groups: [], items: [], depts: [], deptIndex: -1, nickname: '', signedIn: !!this.session })
      if (!this.session) { this.setData({ loading: false }); return }
      try {
        const [identity, mobile] = await Promise.allSettled([
          api.identity(this.session),
          request('/system/auth/get-mobile-permission-info', { header: this.auth() })
        ])
        if (!current(this) || version !== this.version) return
        if (identity.status !== 'fulfilled') throw identity.reason
        this.info = identity.value
        const profile = mobile.status === 'fulfilled' ? mobile.value : null
        this.userId = profile && profile.user && /^\d+$/.test(String(profile.user.id)) ? String(profile.user.id) : ''
        const depts = this.userId && Array.isArray(profile.depts) ? profile.depts.filter(dept => dept && /^\d+$/.test(String(dept.id)) && typeof dept.name === 'string' && dept.name) : []
        const saved = this.userId ? wx.getStorageSync(preference(this)) : ''
        const selected = depts.findIndex(dept => String(dept.id) === String(saved))
        const deptIndex = selected >= 0 ? selected : depts.length ? 0 : -1
        this.setData({ depts, deptIndex, nickname: this.info.user.nickname || this.info.user.username || '', notice: !mine && mobile.status === 'rejected' ? '暂未读取到员工门店范围，可重试；管理入口仍按已读取权限展示。' : '' })
        this.bossReports = false
        if (reports && (can(this.info.permissions, 'sport:check-ggl:query') || can(this.info.permissions, 'sport:check-service:query'))) {
          try { this.bossReports = !!(await api.capabilities(this.session)).reportsEnabled }
          catch (_) { if (current(this) && version === this.version) this.setData({ notice: '暂时无法读取门店报表开放状态，请重试。' }) }
        }
        if (!current(this) || version !== this.version) return
        this.rebuild()
      } catch (error) {
        if (current(this) && version === this.version) this.setData({ error: error.message || '读取失败，请重试', groups: [], items: [] })
      } finally {
        if (current(this) && version === this.version) this.setData({ loading: false })
      }
    },
    auth() {
      if (!current(this)) throw Error('账号已变化，请重新进入')
      const latest = wx.getStorageSync('yc_session')
      return { Authorization: 'Bearer ' + latest.accessToken, 'tenant-id': String(latest.tenantId) }
    },
    rebuild() {
      if (!current(this) || !this.info) return
      const items = [], dept = this.data.depts[this.data.deptIndex]
      const add = (key, title, group, url) => items.push({ key, title, group, url })
      const scope = dept ? '?deptId=' + encodeURIComponent(String(dept.id)) + '&userId=' + encodeURIComponent(this.userId) + '&deptName=' + encodeURIComponent(dept.name) : ''
      if (mine) {
        add('profile', '个人资料', '账号', '/pages/profile/index')
        add('password', '资料与密码设置', '账号', '/pages/boss/profile/index')
        add('inbox', '我的消息', '消息与帮助', '/pages/admin-messaging/inbox/index')
        add('manual', '使用手册', '消息与帮助', '/pages/manual/index')
      } else if (reports) {
        if (dept) add('personal-report', '个人与当前门店销量', '已结店报表', '/pages/report/index' + scope)
        if (this.bossReports) add('boss-reports', '门店报表与个人销量排名', '经营报表', '/pages/boss/reports/index')
      } else {
        if (dept) {
          add('employee-orders', '即开票采购与调拨', '当前门店单据', '/pages/order-ledger/index' + scope)
          add('reserve', '备付金转入与流水', '当前门店单据', '/pages/cash-transfer/index' + scope)
        }
        for (const key of ['inventory', 'funds', 'business', 'costs', 'commission']) {
          if (can(this.info.permissions, resources[key].permission)) add('boss-' + key, resources[key].title, '经营记录', '/pages/boss/records/index?type=' + key)
        }
        for (const entry of visible(this.info).filter(entry => entry.group === '库存与单据')) add(entry.key, entry.title, '授权管理查询', entry.url)
      }
      this.setData({ items, groups: groups(items) })
    },
    department(event) {
      if (!current(this) || this.data.loading) return
      const index = Number(event.detail.value), dept = this.data.depts[index]
      if (!Number.isInteger(index) || !dept) return
      wx.setStorageSync(preference(this), String(dept.id))
      this.setData({ deptIndex: index })
      this.rebuild()
    },
    open(event) {
      if (!current(this) || this.data.loading || this.data.error) return
      const item = this.data.items.find(value => value.key === event.currentTarget.dataset.key)
      if (item) wx.navigateTo({ url: item.url })
    },
    retry() { if (!this.data.loading) { this.session = wx.getStorageSync('yc_session'); this.load() } },
    login() { wx.navigateTo({ url: '/pages/login/index' }) },
    async contact() {
      if (!current(this) || this.contactBusy) return
      this.contactBusy = true
      try {
        const phone = await request('/infra/config/get-value-by-key', { data: { key: 'customerPhone' }, header: this.auth() })
        if (!current(this)) return
        if (typeof phone !== 'string' || !phone.trim()) throw Error('未获取到客服电话')
        wx.makePhoneCall({ phoneNumber: phone.trim(), fail: () => { if (current(this)) wx.showToast({ title: '未能拨打电话', icon: 'none' }) } })
      } catch (error) { if (current(this)) wx.showToast({ title: error.message || '未获取到客服电话', icon: 'none' }) }
      finally { this.contactBusy = false }
    },
    async logout() {
      if (!current(this) || this.logoutBusy) return
      const session = this.session
      const confirmed = await new Promise(resolve => wx.showModal({ title: '退出当前账号', content: '确定退出当前组织账号吗？', success: result => resolve(result.confirm), fail: () => resolve(false) }))
      if (!confirmed || !current(this) || this.logoutBusy) return
      this.logoutBusy = true
      try {
        await request('/system/auth/logout', { method: 'POST', header: this.auth() })
        if (!current(this) || !sameSession(session, wx.getStorageSync('yc_session'))) return
        wx.removeStorageSync('yc_session')
        this.setData({ signedIn: false, nickname: '', items: [], groups: [], depts: [], deptIndex: -1 })
        wx.reLaunch({ url: '/pages/login/index' })
      } catch (error) { if (current(this)) this.setData({ error: error.message || '退出失败，请重试' }) }
      finally { this.logoutBusy = false }
    }
  }
}
module.exports = { createWorkspacePage }
