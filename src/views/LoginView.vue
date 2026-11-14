<script setup lang="ts">
import { ref } from 'vue'
import { request } from '../api/client'
import { saveSession } from '../api/session'
import { accountLoginSession } from '../domain/account-login'
import { liveReturn } from '../domain/live-return'
import { router } from '../router'
const username = ref(''), password = ref(''), busy = ref(false), error = ref('')
async function login() {
  if (busy.value) return
  if (!username.value.trim() || !password.value) { error.value = '请填写账号和密码'; return }
  busy.value = true; error.value = ''
  try {
    const result = await request('/system/auth/account-login', { public: true, method: 'POST', data: { account: username.value.trim(), password: password.value } })
    saveSession(accountLoginSession(result, crypto.randomUUID()))
    password.value = ''; await router.replace(liveReturn(router.currentRoute.value.query.next) || '/')
  } catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
</script>
<template>
  <section class="login" aria-labelledby="login-title">
    <h1 id="login-title">登录易彩</h1>
    <p class="intro">输入账号和密码，系统会自动识别所属组织。</p>
    <van-form class="card" @submit="login">
      <van-field v-model="username" label="账号" placeholder="账号或专属登录号" autocomplete="username" :disabled="busy" />
      <van-field v-model="password" label="密码" type="password" placeholder="请输入密码" autocomplete="current-password" :disabled="busy" />
      <p v-if="error" role="alert" class="error">{{ error }}</p>
      <van-button block type="primary" native-type="submit" :loading="busy" class="submit">登录</van-button>
    </van-form>
    <p class="footnote">开通账号或重置密码，请联系组织管理员。</p>
  </section>
</template>
