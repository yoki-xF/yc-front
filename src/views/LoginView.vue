<script setup lang="ts">
import { ref } from 'vue'
import { request } from '../api/client'
import { saveSession } from '../api/session'
import { accountLoginSession } from '../domain/account-login'
import { router } from '../router'
const username = ref(''), password = ref(''), busy = ref(false), error = ref('')
async function login() {
  if (busy.value) return
  if (!username.value.trim() || !password.value) { error.value = '请填写账号和密码'; return }
  busy.value = true; error.value = ''
  try {
    const result = await request('/system/auth/account-login', { public: true, method: 'POST', data: { account: username.value.trim(), password: password.value } })
    saveSession(accountLoginSession(result, crypto.randomUUID()))
    password.value = ''; await router.replace('/')
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
</script>
<template><div class="login"><p class="eyebrow">让每一天的经营更清晰</p><h1>欢迎回到易彩</h1><p class="intro">一个工作台，连接门店、人员与账目。</p><section class="card"><h2>登录工作台</h2><p class="intro">组织随账号自动识别，无需填写。</p><van-form @submit="login"><van-field v-model="username" label="账号" placeholder="请输入账号或专属登录号" autocomplete="username" :disabled="busy" /><van-field v-model="password" label="密码" type="password" placeholder="请输入登录密码" autocomplete="current-password" :disabled="busy" /><p v-if="error" role="alert" class="error">{{ error }}</p><van-button block type="primary" native-type="submit" :loading="busy" class="submit">登录</van-button></van-form></section><p class="footnote">账号开通及密码重置，请联系组织管理员。</p></div></template>
