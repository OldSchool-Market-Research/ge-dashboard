<script setup lang="ts">
// The verdict at every evaluation, oldest to newest, one cell each in the
// status palette. The tally in the label carries it without color.
import { computed } from 'vue'
import { STATUS } from '@/lib/viz'

const props = defineProps<{ verdicts: string[] }>()

const COLOR: Record<string, string> = { healthy: STATUS.good, degraded: STATUS.warning, kill_signal: STATUS.critical }
const W = 760
const cells = computed(() => {
  const n = Math.max(1, props.verdicts.length)
  const w = W / n
  const by: Record<string, string> = {}
  props.verdicts.forEach((v, i) => {
    by[v] = (by[v] ?? '') + `M${(i * w).toFixed(2)} 0h${Math.max(0.6, w - (w > 3 ? 1 : 0)).toFixed(2)}v12h-${Math.max(0.6, w - (w > 3 ? 1 : 0)).toFixed(2)}Z`
  })
  return Object.entries(by).map(([v, d]) => ({ v, d, color: COLOR[v] ?? 'hsl(var(--muted-foreground))' }))
})
const tally = computed(() => {
  const c: Record<string, number> = {}
  for (const v of props.verdicts) c[v] = (c[v] ?? 0) + 1
  return Object.entries(c).map(([v, n]) => `${n} ${v.replace('_', ' ')}`).join(', ')
})
</script>

<template>
  <svg :viewBox="`0 0 ${W} 12`" preserveAspectRatio="none" class="block h-3 w-full" role="img" :aria-label="`Verdict at each eval: ${tally}`">
    <path v-for="c in cells" :key="c.v" :d="c.d" :style="{ fill: c.color }" />
  </svg>
</template>
