import { createRouter, createWebHashHistory } from 'vue-router'
import { liveReturn } from './domain/live-return'
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
  { path: '/live', component: () => import('./views/LiveRoomsView.vue') },
  { path: '/live/watch/:id', component: () => import('./views/LiveRoomsView.vue') },
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
  { path: '/boss/commission', component: () => import('./views/BossCommissionView.vue') },
  { path: '/boss/schedule', component: () => import('./views/BossScheduleView.vue') },
  { path: '/boss/settings', component: () => import('./views/BossSettingsView.vue') },
  { path: '/boss/configuration', component: () => import('./views/BossConfigurationView.vue') },
  { path: '/boss/roles', component: () => import('./views/BossRolesView.vue') },
  { path: '/admin/user-import', component: () => import('./views/UserImportView.vue') },
  { path: '/boss/employees', component: () => import('./views/BossEmployeesView.vue') },
  { path: '/platform/notifications', component: () => import('./views/NotifyAdminView.vue') },
  { path: '/admin/notices', component: () => import('./views/NoticesView.vue') },
  { path: '/inbox', component: () => import('./views/InboxView.vue') },
  { path: '/admin/logs', component: () => import('./views/AdminLogsView.vue') },
  { path: '/platform/catalog', component: () => import('./views/PlatformCatalogView.vue') },
  { path: '/platform', component: () => import('./views/PlatformView.vue') },
  { path: '/mine', component: () => import('./views/MineView.vue') },
  { path: '/:pathMatch(.*)*', redirect: '/' }
] })
router.beforeEach(to => {
  if (!to.meta.public && !session.value) {
    const next = liveReturn(to.path)
    return next ? { path: '/login', query: { next } } : '/login'
  }
  if (to.path === '/login' && session.value) return liveReturn(to.query.next) || '/'
})
