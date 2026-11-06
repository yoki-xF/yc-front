<script setup lang="ts">
import { ref } from 'vue'
import { request } from '../api/client'
import { saveSession } from '../api/session'
import { router } from '../router'
const tenant = ref(''), username = ref(''), password = ref(''), busy = ref(false), error = ref('')
async function login() {
  if (busy.value) return
  if (!tenant.value.trim() || !username.value.trim() || !password.value) { error.value = '请填写组织、账号和密码'; return }
  busy.value = true; error.value = ''
  try {
    const tenantId = await request<string>('/system/tenant/get-id-by-name', { public: true, data: { name: tenant.value.trim() } })
    if (tenantId == null || !/^\d+$/.test(String(tenantId))) throw Error('未找到该组织，请核对名称')
    const result = await request('/system/auth/login', { public: true, method: 'POST', tenantId: String(tenantId), data: { username: username.value.trim(), password: password.value } })
    if (!result?.accessToken || !result?.refreshToken) throw Error('登录结果不完整')
    saveSession({ tenantId: String(tenantId), tenantName: tenant.value.trim(), accessToken: result.accessToken, refreshToken: result.refreshToken, key: crypto.randomUUID() })
    password.value = ''; await router.replace('/')
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
</script>
<template><div class="login"><p class="eyebrow">让每一天的经营更清晰</p><h1>欢迎回到易彩</h1><p class="intro">一个工作台，连接门店、人员与账目。</p><section class="card"><h2>登录工作台</h2><van-form @submit="login"><van-field v-model="tenant" label="组织" placeholder="请输入组织名称" autocomplete="organization" :disabled="busy" /><van-field v-model="username" label="账号" placeholder="管理员为你开通的账号" autocomplete="username" :disabled="busy" /><van-field v-model="password" label="密码" type="password" placeholder="请输入登录密码" autocomplete="current-password" :disabled="busy" /><p v-if="error" role="alert" class="error">{{ error }}</p><van-button block type="primary" native-type="submit" :loading="busy" class="submit">登录</van-button></van-form></section><p class="footnote">账号开通及密码重置，请联系组织管理员。</p></div></template>
