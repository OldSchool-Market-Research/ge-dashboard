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
      path: '/book/:id',
      name: 'strategy',
      component: () => import('./views/StrategyView.vue'),
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
      path: '/process',
      name: 'process',
      component: () => import('./views/ProcessView.vue'),
    },
    {
      path: '/process/:id',
      name: 'process-recipe',
      component: () => import('./views/ProcessDetailView.vue'),
    },
    {
      path: '/items',
      name: 'items',
      component: () => import('./views/ItemsView.vue'),
    },
    {
      path: '/items/:id',
      name: 'item',
      component: () => import('./views/ItemDetailView.vue'),
    },
    {
      path: '/research',
      name: 'research',
      component: () => import('./views/ResearchView.vue'),
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
    // dev only: the styleguide and its theme lab are a workshop, never shipped —
    // in a build this branch is dead code, so the page isn't even bundled
    ...(import.meta.env.DEV
      ? [
          {
            path: '/styleguide',
            name: 'styleguide',
            component: () => import('@fisherrjd/ui/styleguide').then((m) => m.StyleguidePage),
          },
        ]
      : []),
  ],
  scrollBehavior: () => ({ top: 0 }),
})

export default router
