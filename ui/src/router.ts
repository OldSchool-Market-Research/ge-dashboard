import { createRouter, createWebHistory } from 'vue-router'
import HomeView from './views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'home', component: HomeView },
    {
      path: '/runs',
      name: 'runs',
      component: () => import('./views/RunsView.vue'),
    },
    {
      path: '/runs/:id',
      name: 'run',
      component: () => import('./views/RunDetailView.vue'),
    },
    {
      path: '/book',
      name: 'book',
      component: () => import('./views/BookView.vue'),
    },
    {
      path: '/pnl',
      name: 'pnl',
      component: () => import('./views/PnlView.vue'),
    },
    {
      path: '/calibration',
      name: 'calibration',
      component: () => import('./views/CalibrationView.vue'),
    },
    {
      path: '/signals',
      name: 'signals',
      component: () => import('./views/SignalsView.vue'),
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('./views/SettingsView.vue'),
    },
    {
      path: '/styleguide',
      name: 'styleguide',
      component: () => import('./views/styleguide/StyleguideView.vue'),
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
