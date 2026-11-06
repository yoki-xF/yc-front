import { createRouter, createWebHashHistory } from 'vue-router'
import { session } from './api/session'
export const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/', component: () => import('./views/WorkspaceView.vue') },
  { path: '/records', component: () => import('./views/RecordsView.vue') },
  { path: '/records/:type/:id', component: () => import('./views/DetailView.vue') },
  { path: '/entry/:kind(fund|business)', component: () => import('./views/EmployeeEntryView.vue') },
  { path: '/operating-day', component: () => import('./views/OperatingDayView.vue') },
  { path: '/personal-report', component: () => import('./views/PersonalReportView.vue') },
  { path: '/reports', component: () => import('./views/ReportsView.vue') },
  { path: '/mine', component: () => import('./views/MineView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
] })
router.beforeEach(to => { if (!to.meta.public && !session.value) return '/login'; if (to.path === '/login' && session.value) return '/' })
