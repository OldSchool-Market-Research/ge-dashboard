<script setup lang="ts">
// One processing recipe over time, from the hourly snapshots. Single 2px
// series in the theme's chart color (the title names it, no legend box). The
// line BREAKS wherever the value is null (unpriced) or a bucket is missing
// (no snapshot, e.g. an ingester outage): a gap, never a bridge or a dip to
// zero (nulls are signal). The x-axis is the requested window, so short
// history reads as short. Zero is a labelled reference line when the series
// crosses it. Crosshair tooltip on hover; the legs table and API carry the
// values too.
import { computed, ref } from 'vue'
import { gp, type ProcessHistoryPoint } from '@/lib/api'
import { DIVERGING } from '@/lib/viz'

const props = defineProps<{
  points: ProcessHistoryPoint[]
  metric: 'gp_hr' | 'margin_slow'
  days: number
  bucketHours: number
}>()

const W = 720
const H = 220
const PAD = { l: 52, r: 12, t: 10, b: 22 }
const HOUR = 3600_000

const val = (p: ProcessHistoryPoint) => p[props.metric]

const domain = computed(() => {
  const t1 = Date.now()
  const t0 = t1 - props.days * 24 * HOUR
  const vs = props.points.map(val).filter((v): v is number => v !== null)
  const lo = Math.min(0, ...vs)
  const hi = Math.max(0, ...vs)
  return { t0, t1, ...niceRange(lo, hi === lo ? lo + 1 : hi) }
})

// round the y-range out to 1/2/5 x 10^k steps so tick labels are readable
function niceRange(lo: number, hi: number) {
  const raw = (hi - lo) / 3
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

// Segments: consecutive buckets with a value and no missing bucket between.
const segments = computed(() => {
  const out: ProcessHistoryPoint[][] = []
  let cur: ProcessHistoryPoint[] = []
  let prevT = -Infinity
  for (const p of props.points) {
    const t = new Date(p.bucket).getTime()
    const contiguous = t - prevT <= props.bucketHours * HOUR * 1.01
    if (val(p) === null || !contiguous) {
      if (cur.length) out.push(cur)
      cur = []
    }
    if (val(p) !== null) cur.push(p)
    prevT = t
  }
  if (cur.length) out.push(cur)
  return out
})

const paths = computed(() =>
  segments.value
    .filter((s) => s.length > 1)
    .map((s) => s.map((p, i) => `${i ? 'L' : 'M'}${x(p.bucket).toFixed(1)},${y(val(p) as number).toFixed(1)}`).join(' ')),
)
// a segment of one point would be invisible as a path: draw it as a dot
const dots = computed(() => segments.value.filter((s) => s.length === 1).map((s) => s[0]))

const ticks = computed(() => {
  const { lo, hi, step } = domain.value
  const out: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Math.round(v))
  return out
})

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
      :aria-label="`${metric === 'gp_hr' ? 'gp per hour' : 'margin per action'} over the last ${days} days for this recipe`"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <g v-for="t in ticks" :key="t">
        <line
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="y(t)"
          :y2="y(t)"
          :class="t === 0 ? 'stroke-muted-foreground' : 'stroke-border'"
          :stroke-width="t === 0 ? 1 : 0.5"
        />
        <text :x="PAD.l - 5" :y="y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">
          {{ gp(t) }}
        </text>
      </g>
      <text :x="PAD.l" :y="H - 6" class="fill-muted-foreground text-[10px]">{{ when(domain.t0) }}</text>
      <text :x="W - PAD.r" :y="H - 6" text-anchor="end" class="fill-muted-foreground text-[10px]">{{ when(domain.t1) }} UTC</text>
      <path
        v-for="(d, i) in paths"
        :key="i"
        :d="d"
        fill="none"
        :style="{ stroke: DIVERGING.pos }"
        stroke-width="2"
        stroke-linejoin="round"
        stroke-linecap="round"
      />
      <circle
        v-for="p in dots"
        :key="p.bucket"
        :cx="x(p.bucket)"
        :cy="y(val(p) as number)"
        r="4"
        :style="{ fill: DIVERGING.pos }"
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
      <div class="font-medium tabular-nums">
        {{ val(hover.p) === null ? 'unpriced' : `${gp(val(hover.p))} ${metric === 'gp_hr' ? 'gp/hr' : 'gp/action'}` }}
      </div>
      <div class="text-muted-foreground tabular-nums">
        <template v-if="metric === 'gp_hr'">margin {{ gp(hover.p.margin_slow) }} · </template>{{ when(hover.p.bucket) }} UTC
      </div>
      <div v-if="hover.p.priced_hours < hover.p.hours" class="text-muted-foreground">
        {{ hover.p.priced_hours }}/{{ hover.p.hours }} hours priced
      </div>
    </div>
  </div>
</template>
