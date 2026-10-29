<script setup lang="ts">
// One processing recipe's gp/hr over time, from the hourly snapshots. Single
// 2px series in the theme's chart color (the title names it, no legend box);
// a bucket with no priced hour is a GAP in the line, never a dip to zero
// (nulls are signal). Zero is drawn as a reference line when the series
// crosses it. Crosshair tooltip on hover; values also in the legs table/API.
import { computed, ref } from 'vue'
import { gp, type ProcessHistoryPoint } from '@/lib/api'
import { DIVERGING } from '@/lib/viz'

const props = defineProps<{ points: ProcessHistoryPoint[] }>()

const W = 720
const H = 220
const PAD = { l: 48, r: 12, t: 10, b: 22 }

const priced = computed(() => props.points.filter((p) => p.gp_hr !== null))

const domain = computed(() => {
  const ts = props.points.map((p) => new Date(p.bucket).getTime())
  const vs = priced.value.map((p) => p.gp_hr as number)
  const t0 = Math.min(...ts)
  const t1 = Math.max(...ts)
  const lo = Math.min(0, ...vs)
  const hi = Math.max(1, ...vs)
  return { t0, t1: t1 === t0 ? t0 + 1 : t1, lo, hi: hi === lo ? lo + 1 : hi }
})

function x(iso: string): number {
  const { t0, t1 } = domain.value
  return PAD.l + ((new Date(iso).getTime() - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
}
function y(v: number): number {
  const { lo, hi } = domain.value
  return PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
}

// break the path at every null bucket: M starts a new segment after a gap
const path = computed(() => {
  let d = ''
  let pen = false
  for (const p of props.points) {
    if (p.gp_hr === null) {
      pen = false
      continue
    }
    d += `${pen ? 'L' : 'M'}${x(p.bucket).toFixed(1)},${y(p.gp_hr).toFixed(1)} `
    pen = true
  }
  return d
})

// isolated priced points (null on both sides) would be invisible as a path
const dots = computed(() =>
  props.points.filter((p, i) => {
    if (p.gp_hr === null) return false
    const prev = props.points[i - 1]
    const next = props.points[i + 1]
    return (!prev || prev.gp_hr === null) && (!next || next.gp_hr === null)
  }),
)

const ticks = computed(() => {
  const { lo, hi } = domain.value
  return [hi, (hi + lo) / 2, lo]
})
const crossesZero = computed(() => domain.value.lo < 0)

const hover = ref<{ px: number; p: ProcessHistoryPoint } | null>(null)

function onMove(e: MouseEvent) {
  if (!props.points.length) return
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * W
  let best = props.points[0]
  for (const p of props.points) if (Math.abs(x(p.bucket) - px) < Math.abs(x(best.bucket) - px)) best = p
  hover.value = { px: x(best.bucket), p: best }
}

function when(iso: string) {
  const d = new Date(iso)
  return `${d.toISOString().slice(5, 10)} ${d.toISOString().slice(11, 16)}`
}
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      role="img"
      aria-label="gp per hour over time for this recipe"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <g v-for="t in ticks" :key="t">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" class="stroke-border" stroke-width="0.5" />
        <text :x="PAD.l - 5" :y="y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">
          {{ gp(t) }}
        </text>
      </g>
      <line v-if="crossesZero" :x1="PAD.l" :x2="W - PAD.r" :y1="y(0)" :y2="y(0)" class="stroke-muted-foreground" stroke-width="1" />
      <text v-if="points.length" :x="PAD.l" :y="H - 6" class="fill-muted-foreground text-[10px]">{{ when(points[0].bucket) }}</text>
      <text v-if="points.length" :x="W - PAD.r" :y="H - 6" text-anchor="end" class="fill-muted-foreground text-[10px]">
        {{ when(points[points.length - 1].bucket) }}
      </text>
      <path :d="path" fill="none" :stroke="DIVERGING.pos" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" />
      <circle
        v-for="p in dots"
        :key="p.bucket"
        :cx="x(p.bucket)"
        :cy="y(p.gp_hr as number)"
        r="4"
        :fill="DIVERGING.pos"
        class="stroke-background"
        stroke-width="2"
      />
      <line v-if="hover" :x1="hover.px" :x2="hover.px" :y1="PAD.t" :y2="H - PAD.b" class="stroke-muted-foreground" stroke-width="0.75" />
    </svg>
    <div
      v-if="hover"
      class="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${(hover.px / W) * 100}%`, transform: 'translateX(-50%)' }"
    >
      <div class="font-medium tabular-nums">{{ hover.p.gp_hr === null ? 'unpriced' : `${gp(hover.p.gp_hr)} gp/hr` }}</div>
      <div class="text-muted-foreground tabular-nums">margin {{ gp(hover.p.margin_slow) }} · {{ when(hover.p.bucket) }}</div>
      <div v-if="hover.p.priced_hours < hover.p.hours" class="text-muted-foreground">
        {{ hover.p.priced_hours }}/{{ hover.p.hours }} hours priced
      </div>
    </div>
  </div>
</template>
