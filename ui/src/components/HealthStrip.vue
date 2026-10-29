<script setup lang="ts">
// How a strategy's evaluations split by verdict, as one proportional strip
// (status palette, 2px gaps). The counts are spelled out beside it, so the
// color is never the only carrier.
import { computed } from 'vue'
import { STATUS } from '@/lib/viz'

const props = defineProps<{ counts: Record<string, number> }>()

const parts = computed(() =>
  [
    { key: 'healthy', label: 'ok', color: STATUS.good },
    { key: 'degraded', label: 'degraded', color: STATUS.warning },
    { key: 'kill_signal', label: 'kill', color: STATUS.critical },
  ].map((p) => ({ ...p, n: props.counts[p.key] ?? 0 })),
)
const total = computed(() => parts.value.reduce((s, p) => s + p.n, 0))
const text = computed(() => parts.value.map((p) => `${p.n} ${p.label}`).join(' · '))
</script>

<template>
  <div class="space-y-1">
    <div class="flex justify-between gap-2 text-xs text-muted-foreground">
      <span>Health over {{ total }} evals</span>
      <span class="font-mono tabular-nums">{{ text }}</span>
    </div>
    <div class="flex h-2 gap-0.5" role="img" :aria-label="`Health over ${total} evals: ${text}`">
      <template v-for="p in parts" :key="p.key">
        <div v-if="p.n" class="min-w-1 rounded-[1px]" :style="{ flex: `${p.n} 1 0`, background: p.color }" />
      </template>
      <div v-if="!total" class="flex-1 bg-muted" />
    </div>
  </div>
</template>
