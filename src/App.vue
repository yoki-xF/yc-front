<script setup lang="ts">
import { watch } from 'vue'
import { useRoute } from 'vue-router'
import { router } from './router'
import { session } from './api/session'
import { clearAccount } from './api/account'
const route = useRoute()
watch(() => session.value?.key, key => { clearAccount(); if (!key) router.replace('/login') })
</script>
<template>
  <div class="app-shell">
    <header class="brand"><router-link to="/" class="brand-mark">易</router-link><div><strong>易彩</strong><span>门店经营管理</span></div><span class="edition">H5</span></header>
    <main><router-view :key="route.fullPath" /></main>
    <van-tabbar v-if="session" route safe-area-inset-bottom>
      <van-tabbar-item to="/" icon="wap-home-o">工作台</van-tabbar-item>
      <van-tabbar-item to="/records" icon="orders-o">记录</van-tabbar-item>
      <van-tabbar-item to="/reports" icon="chart-trending-o">报表</van-tabbar-item>
      <van-tabbar-item to="/mine" icon="user-o">我的</van-tabbar-item>
    </van-tabbar>
  </div>
</template>
