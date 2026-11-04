const { request, newSessionKey } = require('../../utils/request')
Page({
  data: { tenant: '', username: '', password: '', busy: false, error: '' },
  onInput(event) { this.setData({ [event.currentTarget.dataset.field]: event.detail.value, error: '' }) },
  async submit() {
    if (this.data.busy) return
    const tenant = this.data.tenant.trim()
    const username = this.data.username.trim()
    const password = this.data.password
    if (!tenant || !username || !password) { this.setData({ error: '请填写组织、账号和密码' }); return }
    this.setData({ busy: true, error: '' })
    try {
      const tenantId = await request('/system/tenant/get-id-by-name?name=' + encodeURIComponent(tenant))
      if (tenantId == null) throw new Error('未找到该组织，请检查名称')
      const result = await request('/system/auth/login', { method: 'POST', data: { username, password }, header: { 'tenant-id': String(tenantId) } })
      if (!result || !result.accessToken) throw new Error('登录结果不完整，请重试')
      wx.setStorageSync('yc_session', { tenantId, tenantName: tenant, accessToken: result.accessToken, refreshToken: result.refreshToken, sessionKey:newSessionKey() })
      this.setData({ password: '' })
      wx.reLaunch({ url: '/pages/index/index' })
    } catch (error) { this.setData({ error: error.message || '登录失败，请重试' }) }
    finally { this.setData({ busy: false }) }
  }
})
