<script setup lang="ts">
import type { Component } from 'vue'
import { TrendingDownIcon, TrendingUpIcon } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { Card } from '@/components/ui/card'
import Sparkline from './Sparkline.vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: number
    /** turns the (possibly mid-animation, fractional) number into display text */
    format?: (n: number) => string
    /** percent change vs the previous period; sign picks the trend color */
    delta?: number
    /** recent values for the sparkline */
    data?: number[]
    icon?: Component
  }>(),
  { format: (n: number) => Math.round(n).toLocaleString('en-US') },
)

// count up towards the target so value changes feel alive
const shown = ref(0)
let raf = 0
function animateTo(target: number) {
  cancelAnimationFrame(raf)
  const from = shown.value
  const start = performance.now()
  const duration = 600
  const tick = (now: number) => {
    const t = Math.min((now - start) / duration, 1)
    shown.value = from + (target - from) * (1 - (1 - t) ** 3)
    if (t < 1) raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}
onMounted(() => animateTo(props.value))
onUnmounted(() => cancelAnimationFrame(raf))
watch(() => props.value, animateTo)

const display = computed(() => props.format(shown.value))
const deltaText = computed(() =>
  props.delta === undefined ? '' : `${props.delta > 0 ? '+' : ''}${props.delta.toFixed(1)}%`,
)
</script>

<template>
  <Card class="gap-0 p-5 transition-[border-color] hover:border-primary/40">
    <div class="flex items-center justify-between gap-2">
      <p class="text-sm text-muted-foreground">{{ label }}</p>
      <span v-if="icon" class="grid size-7 place-items-center rounded-md bg-primary/10 text-primary">
        <component :is="icon" class="size-4" />
      </span>
    </div>
    <p class="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{{ display }}</p>
    <div class="mt-3 flex items-end justify-between gap-4">
      <p
        v-if="delta !== undefined"
        class="flex items-center gap-1 text-xs font-medium"
        :class="delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'"
      >
        <TrendingUpIcon v-if="delta >= 0" class="size-3.5" />
        <TrendingDownIcon v-else class="size-3.5" />
        {{ deltaText }}
        <span class="font-normal text-muted-foreground">vs last period</span>
      </p>
      <div v-if="data" class="h-9 w-24 shrink-0 text-primary">
        <Sparkline :data="data" />
      </div>
    </div>
  </Card>
</template>
