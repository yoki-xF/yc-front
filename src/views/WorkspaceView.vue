<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { loadAccount, identity, departments, selectedDept, allowed, employeeScopeError } from '../api/account'
import { session } from '../api/session'
import { resources } from '../domain/resources.js'
import PageState from '../components/PageState.vue'
const loading = ref(true), error = ref('')
const modules = computed(() => Object.entries(resources).filter(([, r]) => allowed(r.permission)))
async function load() { loading.value = true; error.value = ''; try { await loadAccount() } catch (e) { error.value = (e as Error).message } finally { loading.value = false } }
onMounted(load)
</script>
<template><div class="page-title"><p class="eyebrow">WORKSPACE / 工作台</p><h1>经营有序，账目清楚</h1><p class="intro">{{ session?.tenantName }} · {{ identity?.user.nickname || identity?.user.username || '欢迎回来' }}</p></div><PageState :loading="loading" :error="error" @retry="load"><van-notice-bar v-if="employeeScopeError" wrapable :text="employeeScopeError" /><section class="hero"><span>当前员工门店</span><select v-if="departments.length" v-model="selectedDept" aria-label="当前员工门店"><option v-for="dept in departments" :key="dept.id" :value="dept.id">{{ dept.name }}</option></select><h2 v-else>{{ employeeScopeError ? '员工门店范围读取失败' : '暂无员工门店授权' }}</h2><p>门店共用库存与资金，个人统计电彩和竞彩销量。</p></section><router-link v-if="departments.length" to="/personal-report" class="module-card quick-link"><strong>我的销量</strong><span>个人电彩、竞彩 · 按营业日查询 ↗</span></router-link><router-link v-if="allowed('sport:business-day:query')" to="/operating-day" class="module-card quick-link"><strong>营业日管理</strong><span>查看状态、开店与结店核对 ↗</span></router-link><div class="section-title"><h2>经营查询</h2><span>按账号权限展示</span></div><div class="module-grid"><router-link v-for="[key, item] in modules" :key="key" :to="'/records?type=' + key" class="module-card"><van-icon :name="key === 'users' || key === 'roles' ? 'friends-o' : 'notes-o'" /><strong>{{ item.title }}</strong><span>查询记录与详情 <b>↗</b></span></router-link></div><van-empty v-if="!modules.length && !departments.length" description="暂无经营查询入口，请联系管理员配置权限" /><section class="card note"><h2>H5 功能正在重建</h2><p>已开放经营查询、个人销量及有权限的营业日管理。盘点录入、更正和平台管理等功能正在接入。</p></section></PageState></template>
