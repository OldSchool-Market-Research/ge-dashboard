<script setup lang="ts">
import { AppShell, type NavSection } from '@fisherrjd/ui/layout'
import {
  BookOpenIcon,
  CoinsIcon,
  CrosshairIcon,
  FactoryIcon,
  FlaskConicalIcon,
  LayoutDashboardIcon,
  LightbulbIcon,
  PackageSearchIcon,
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
      { to: '/', label: 'Command center', icon: LayoutDashboardIcon },
      { to: '/book', label: 'Strategy board', icon: BookOpenIcon },
      { to: '/runs', label: 'Run health', icon: FlaskConicalIcon },
      { to: '/pnl', label: 'Performance', icon: TrendingUpIcon },
      { to: '/calibration', label: 'Calibration', icon: CrosshairIcon },
      { to: '/signals', label: 'Signals', icon: RadioIcon },
      { to: '/research', label: 'Research', icon: LightbulbIcon },
    ],
  },
  {
    label: 'Market',
    links: [
      { to: '/items', label: 'Items', icon: PackageSearchIcon },
      { to: '/process', label: 'Processing', icon: FactoryIcon },
    ],
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
