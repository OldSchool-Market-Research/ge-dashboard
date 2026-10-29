<script setup lang="ts">
import { AppShell, type NavSection } from '@fisherrjd/ui/layout'
import {
  BookOpenIcon,
  CoinsIcon,
  CrosshairIcon,
  FactoryIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  PaletteIcon,
  RadioIcon,
  SettingsIcon,
  TrendingUpIcon,
} from '@lucide/vue'
import { RouterView } from 'vue-router'

const nav: NavSection[] = [
  {
    label: 'Engine',
    links: [
      { to: '/', label: 'Overview', icon: LayoutDashboardIcon },
      { to: '/book', label: 'Book', icon: BookOpenIcon },
      { to: '/runs', label: 'Runs', icon: FlaskConicalIcon },
      { to: '/pnl', label: 'P&L', icon: TrendingUpIcon },
      { to: '/calibration', label: 'Calibration', icon: CrosshairIcon },
      { to: '/signals', label: 'Signals', icon: RadioIcon },
    ],
  },
  {
    label: 'Market',
    links: [{ to: '/process', label: 'Processing', icon: FactoryIcon }],
  },
  {
    label: 'App',
    links: [
      { to: '/settings', label: 'Settings', icon: SettingsIcon },
      // dev only, like its route (src/router.ts)
      ...(import.meta.env.DEV ? [{ to: '/styleguide', label: 'Styleguide', icon: PaletteIcon }] : []),
    ],
  },
]
</script>

<template>
  <AppShell brand="GE Dashboard" :icon="CoinsIcon" :nav="nav">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" />
      </Transition>
    </RouterView>
  </AppShell>
</template>
