import { createRouter, createWebHashHistory } from 'vue-router'
import { session } from './api/session'
export const router = createRouter({ history: createWebHashHistory(), routes: [
  { path: '/login', component: () => import('./views/LoginView.vue'), meta: { public: true } },
  { path: '/', component: () => import('./views/WorkspaceView.vue') },
  { path: '/records', component: () => import('./views/RecordsView.vue') },
  { path: '/records/:type/:id', component: () => import('./views/DetailView.vue') },
  { path: '/store-opening', component: () => import('./views/OpeningView.vue') },
  { path: '/corrections/:type(inventory|funds|business|commission)/:id', component: () => import('./views/CorrectionView.vue') },
  { path: '/catalog/:type(materials|costs)/new', component: () => import('./views/CatalogFormView.vue') },
  { path: '/catalog/:type(materials|costs)/:id/edit', component: () => import('./views/CatalogFormView.vue') },
  { path: '/activities', component: () => import('./views/ActivityEntryView.vue') },
  { path: '/cash-ledger', component: () => import('./views/CashLedgerView.vue') },
  { path: '/orders', component: () => import('./views/OrderLedgerView.vue') },
  { path: '/check-status', component: () => import('./views/CheckStatusView.vue') },
  { path: '/count/:kind(morning|evening)', component: () => import('./views/InventoryEntryView.vue') },
  { path: '/entry/:kind(fund|business)', component: () => import('./views/EmployeeEntryView.vue') },
  { path: '/operating-day', component: () => import('./views/OperatingDayView.vue') },
  { path: '/personal-report', component: () => import('./views/PersonalReportView.vue') },
  { path: '/reports', component: () => import('./views/ReportsView.vue') },
  { path: '/profile', component: () => import('./views/ProfileView.vue') },
  { path: '/guide', component: () => import('./views/GuideView.vue') },
  { path: '/mine', component: () => import('./views/MineView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
] })
router.beforeEach(to => { if (!to.meta.public && !session.value) return '/login'; if (to.path === '/login' && session.value) return '/' })
