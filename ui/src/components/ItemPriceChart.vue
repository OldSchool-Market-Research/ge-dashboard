<script setup lang="ts">
// One item's insta-buy and insta-sell prices over the requested window: two
// 2px lines in the validated categorical palette's first two slots (fixed
// order, so "insta-buy" is always the same colour), legend always present.
// A bucket where nothing traded that side is a GAP in that line, and so is a
// missing bucket (no rows at all), never a bridge or a dip to zero. The
// y-axis fits the prices (it isn't a magnitude chart, so no zero baseline).
// Crosshair tooltip lists both series; volume is its own chart below (one
// axis per chart, never a dual axis).
import { useTheme } from '@fisherrjd/ui/theme'
import { computed, ref } from 'vue'
import { gp, type ItemHistoryPoint } from '@/lib/api'
import { SERIES_DARK, SERIES_LIGHT } from '@/lib/viz'

const props = defineProps<{ points: ItemHistoryPoint[]; days: number; bucketMinutes: number }>()
const { mode } = useTheme()

const W = 720
const H = 240
const PAD = { l: 52, r: 12, t: 10, b: 22 }
const MIN = 60_000

const series = computed(() => {
  const pal = mode.value === 'dark' ? SERIES_DARK : SERIES_LIGHT
  return [
    { key: 'avg_high' as const, label: 'Insta-buy', color: pal[0] },
    { key: 'avg_low' as const, label: 'Insta-sell', color: pal[1] },
  ]
})

const domain = computed(() => {
  const t1 = Date.now()
  const t0 = t1 - props.days * 24 * 60 * MIN
  const vs = props.points.flatMap((p) => [p.avg_high, p.avg_low]).filter((v): v is number => v !== null)
  const lo = vs.length ? Math.min(...vs) : 0
  const hi = vs.length ? Math.max(...vs) : 1
  return { t0, t1, ...niceRange(lo, hi === lo ? lo + 1 : hi) }
})

// round out to 1/2/5 x 10^k steps (at least 1 gp) so tick labels read cleanly
function niceRange(lo: number, hi: number) {
  const raw = Math.max((hi - lo) / 3, 1)
  const mag = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag
  return { lo: Math.floor(lo / step) * step, hi: Math.ceil(hi / step) * step, step }
}

function x(iso: string): number {
  const { t0, t1 } = domain.value
  const t = Math.min(Math.max(new Date(iso).getTime(), t0), t1)
  return PAD.l + ((t - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
}
function y(v: number): number {
  const { lo, hi } = domain.value
  return PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
}

// per series: segments of consecutive priced buckets with no missing bucket between
function segments(key: 'avg_high' | 'avg_low') {
  const out: ItemHistoryPoint[][] = []
  let cur: ItemHistoryPoint[] = []
  let prevT = -Infinity
  for (const p of props.points) {
    const t = new Date(p.bucket).getTime()
    if (p[key] === null || t - prevT > props.bucketMinutes * MIN * 1.01) {
      if (cur.length) out.push(cur)
      cur = []
    }
    if (p[key] !== null) cur.push(p)
    prevT = t
  }
  if (cur.length) out.push(cur)
  return out
}

const drawn = computed(() =>
  series.value.map((s) => {
    const segs = segments(s.key)
    return {
      ...s,
      paths: segs
        .filter((g) => g.length > 1)
        .map((g) => g.map((p, i) => `${i ? 'L' : 'M'}${x(p.bucket).toFixed(1)},${y(p[s.key] as number).toFixed(1)}`).join(' ')),
      dots: segs.filter((g) => g.length === 1).map((g) => g[0]),
    }
  }),
)

const ticks = computed(() => {
  const { lo, hi, step } = domain.value
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v))
  return out
})

const hover = ref<{ px: number; p: ItemHistoryPoint } | null>(null)
function onMove(e: MouseEvent) {
  if (!props.points.length) return
  const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * W
  let best = props.points[0]
  for (const p of props.points) if (Math.abs(x(p.bucket) - px) < Math.abs(x(best.bucket) - px)) best = p
  hover.value = { px: x(best.bucket), p: best }
}

function when(t: number | string) {
  const s = new Date(t).toISOString()
  return `${s.slice(5, 10)} ${s.slice(11, 16)}`
}
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      role="img"
      :aria-label="`insta-buy and insta-sell price over the last ${days} days`"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <g v-for="t in ticks" :key="t">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" class="stroke-border" stroke-width="0.5" />
        <text :x="PAD.l - 5" :y="y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">{{ gp(t) }}</text>
      </g>
      <text :x="PAD.l" :y="H - 6" class="fill-muted-foreground text-[10px]">{{ when(domain.t0) }}</text>
      <text :x="W - PAD.r" :y="H - 6" text-anchor="end" class="fill-muted-foreground text-[10px]">{{ when(domain.t1) }} UTC</text>
      <g v-for="s in drawn" :key="s.key">
        <path
          v-for="(d, i) in s.paths"
          :key="i"
          :d="d"
          fill="none"
          :style="{ stroke: s.color }"
          stroke-width="2"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
        <circle
          v-for="p in s.dots"
          :key="p.bucket"
          :cx="x(p.bucket)"
          :cy="y(p[s.key] as number)"
          r="4"
          :style="{ fill: s.color }"
          class="stroke-background"
          stroke-width="2"
        />
      </g>
      <line v-if="hover" :x1="hover.px" :x2="hover.px" :y1="PAD.t" :y2="H - PAD.b" class="stroke-muted-foreground" stroke-width="0.75" />
    </svg>
    <div
      v-if="hover"
      class="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${(hover.px / W) * 100}%`, transform: 'translateX(-50%)' }"
    >
      <div class="font-medium">{{ when(hover.p.bucket) }} UTC</div>
      <div v-for="s in series" :key="s.key" class="flex items-center gap-1.5 tabular-nums">
        <span class="h-0.5 w-3 rounded-full" :style="{ background: s.color }" />
        <span class="font-medium">{{ hover.p[s.key] === null ? 'no trade' : gp(hover.p[s.key]) }}</span>
        <span class="text-muted-foreground">{{ s.label }}</span>
      </div>
    </div>
    <!-- legend: always present for two series -->
    <div class="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span v-for="s in series" :key="s.key" class="inline-flex items-center gap-1.5">
        <span class="h-0.5 w-4 rounded-full" :style="{ background: s.color }" />
        {{ s.label }}
      </span>
    </div>
  </div>
</template>
