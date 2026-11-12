<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { showConfirmDialog } from 'vant'
import { session, saveSession } from '../api/session'
import { identity, clearAccount, loadAccount, canManagePlatform, allowed } from '../api/account'
import { request } from '../api/client'
const busy = ref(false), error = ref('')
onMounted(async () => {
  if (identity.value) return
  const key = session.value?.key
  busy.value = true
  try { await loadAccount() } catch (e) { if (session.value?.key === key) error.value = (e as Error).message }
  finally { if (session.value?.key === key) busy.value = false }
})
async function logout() {
  if (busy.value) return
  try { await showConfirmDialog({ title: '退出当前账号', message: '确定退出当前组织账号吗？' }) } catch { return }
  const key = session.value?.key
  busy.value = true; error.value = ''
  try { await request('/system/auth/logout', { method: 'POST' }); if (session.value?.key === key) { saveSession(null); clearAccount() } }
  catch (e) { error.value = (e as Error).message } finally { busy.value = false }
}
</script>
<template><div class="page-title"><p class="eyebrow">ACCOUNT / 我的</p><h1>{{ identity?.user.nickname || identity?.user.username || '我的账号' }}</h1><p class="intro">管理当前组织的登录状态。</p></div><section class="card"><dl><div><dt>所属组织</dt><dd>{{ session?.tenantName }}</dd></div><div><dt>专属登录号</dt><dd>{{ identity?.user.id ? `yc-${identity.user.id}` : '—' }}</dd></div><div><dt>当前版本</dt><dd>H5 重建 · 0.1</dd></div></dl><p class="intro">账号开通和密码重置由管理员协助处理。同名账号可使用上方专属登录号，组织会自动识别。</p></section><router-link to="/profile" class="module-card quick-link"><strong>个人资料</strong><span>姓名、联系方式与性别 ↗</span></router-link><router-link v-if="canManagePlatform()" to="/platform" class="module-card quick-link"><strong>平台管理</strong><span>组织与套餐查询 ↗</span></router-link><router-link v-if="allowed('system:post:query') || (identity?.roles?.includes('super_admin') && (allowed('system:dict:query') || allowed('system:menu:query')))" to="/platform/catalog" class="module-card quick-link"><strong>岗位、字典与菜单</strong><span>维护岗位、字典和菜单层级 ↗</span></router-link><router-link v-if="allowed('system:login-log:query') || allowed('system:operate-log:query')" to="/admin/logs" class="module-card quick-link"><strong>组织日志</strong><span>查询登录和操作记录 ↗</span></router-link><router-link v-if="allowed('system:notice:query')" to="/admin/notices" class="module-card quick-link"><strong>组织公告</strong><span>维护公告和预览推送范围 ↗</span></router-link><router-link v-if="identity?.roles?.includes('super_admin') && (allowed('system:notify-template:query') || allowed('system:notify-message:query'))" to="/platform/notifications" class="module-card quick-link"><strong>站内通知管理</strong><span>维护模板和查询发送记录 ↗</span></router-link><router-link to="/inbox" class="module-card quick-link"><strong>站内通知</strong><span>查看我的通知 ↗</span></router-link><router-link to="/guide" class="module-card quick-link"><strong>操作指引</strong><span>营业日、盘点与账目核对 ↗</span></router-link><section v-if="error" class="card error" role="alert">{{ error }}</section><van-button block plain type="danger" :loading="busy" @click="logout">退出当前账号</van-button></template>
