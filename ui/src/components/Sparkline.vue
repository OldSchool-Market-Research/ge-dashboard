<script setup lang="ts">
// A small single-series line over time, with a dashed zero line when the
// values cross it. Nulls are gaps (nothing priced), never zero. No axes: the
// numbers sit beside it, the aria-label says what it is.
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{ values: (number | null)[]; label: string; height?: number; min?: number; max?: number }>(),
  { height: 48, min: undefined, max: undefined },
)

const W = 300

const geo = computed(() => {
  const vals = props.values.filter((v): v is number => v !== null)
  if (!vals.length) return null
  const lo = props.min ?? Math.min(0, ...vals)
  const hi = props.max ?? Math.max(0, ...vals)
  const span = hi - lo || 1
  const H = props.height
  const pad = 3
  const y = (v: number) => pad + ((hi - v) / span) * (H - 2 * pad)
  const n = props.values.length
  const x = (i: number) => (n === 1 ? W / 2 : (i / (n - 1)) * W)
  const base = y(Math.max(lo, Math.min(hi, 0)))
  let line = ''
  let area = ''
  let seg: [number, number][] = []
  const flush = () => {
    if (!seg.length) return
    const d = seg.map(([sx, sy], j) => `${j ? 'L' : 'M'}${sx.toFixed(1)} ${sy.toFixed(1)}`).join('')
    line += d
    area += `${d}L${seg[seg.length - 1][0].toFixed(1)} ${base.toFixed(1)}L${seg[0][0].toFixed(1)} ${base.toFixed(1)}Z`
    seg = []
  }
  props.values.forEach((v, i) => (v === null ? flush() : seg.push([x(i), y(v)])))
  flush()
  return { line, area, zero: lo < 0 && hi > 0 ? y(0) : null }
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${W} ${height}`"
    preserveAspectRatio="none"
    class="block w-full"
    :style="{ height: `${height}px` }"
    role="img"
    :aria-label="label"
  >
    <template v-if="geo">
      <path :d="geo.area" class="fill-chart-1/15" />
      <line
        v-if="geo.zero !== null"
        x1="0"
        :x2="W"
        :y1="geo.zero"
        :y2="geo.zero"
        class="stroke-muted-foreground/60"
        stroke-dasharray="3 3"
        vector-effect="non-scaling-stroke"
      />
      <path :d="geo.line" fill="none" class="stroke-chart-1" stroke-width="2" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    </template>
    <text v-else x="0" :y="height / 2" class="fill-muted-foreground text-[11px]">no data yet</text>
  </svg>
</template>
