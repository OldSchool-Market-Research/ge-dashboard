<script setup lang="ts">
// One series over time with an optional area, dashed reference lines (a
// plan, a projection) and point markers (kill signals). Nulls are gaps. One
// axis only; the zero line is solid when the values cross it. Crosshair +
// tooltip on hover, per the dataviz spec.
import { computed, ref } from 'vue'
import { gp } from '@/lib/api'
import { STATUS } from '@/lib/viz'

const props = withDefaults(
  defineProps<{
    points: { t: number; v: number | null }[]
    label: string
    refs?: { v: number; label: string }[]
    markers?: { t: number; v: number; label: string }[]
    format?: (v: number) => string
    days?: boolean // x labels as dates only
    area?: boolean
    height?: number
    width?: number // viewBox width: smaller in narrow columns keeps the text legible
  }>(),
  { refs: () => [], markers: () => [], format: undefined, days: false, area: true, height: 240, width: 760 },
)

const W = props.width
const PAD = { l: 52, r: 10, t: 12, b: 24 }
const fmt = (v: number) => (props.format ? props.format(v) : gp(v))

const hover = ref<number | null>(null)

const geo = computed(() => {
  const H = props.height
  const pts = props.points
  const vals = [...pts.map((p) => p.v).filter((v): v is number => v !== null), ...props.refs.map((r) => r.v), 0]
  let lo = Math.min(...vals)
  let hi = Math.max(...vals)
  if (hi === lo) hi = lo + 1
  const pad = (hi - lo) * 0.06
  hi += pad
  if (lo < 0) lo -= pad
  const t0 = pts[0]?.t ?? 0
  const t1 = pts[pts.length - 1]?.t ?? 1
  const x = (t: number) => PAD.l + ((t - t0) / (t1 - t0 || 1)) * (W - PAD.l - PAD.r)
  const y = (v: number) => PAD.t + ((hi - v) / (hi - lo)) * (H - PAD.t - PAD.b)
  let line = ''
  let area = ''
  let seg: string[] = []
  let first = 0
  let last = 0
  const base = y(Math.max(lo, 0))
  const flush = () => {
    if (!seg.length) return
    const d = seg.join('')
    line += d
    area += `${d}L${last.toFixed(1)} ${base.toFixed(1)}L${first.toFixed(1)} ${base.toFixed(1)}Z`
    seg = []
  }
  pts.forEach((p) => {
    if (p.v === null) return flush()
    const px = x(p.t)
    if (!seg.length) first = px
    last = px
    seg.push(`${seg.length ? 'L' : 'M'}${px.toFixed(1)} ${y(p.v).toFixed(1)}`)
  })
  flush()
  // ~5 nice y ticks
  const range = hi - lo
  const mag = 10 ** Math.floor(Math.log10(range / 4))
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => range / s <= 5) ?? mag * 10
  const yTicks: number[] = []
  for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) yTicks.push(v)
  const xTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => t0 + f * (t1 - t0))
  return { x, y, line, area, yTicks, xTicks, zero: lo < 0 ? y(0) : null, H }
})

function xLabel(t: number) {
  const d = new Date(t)
  const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  if (props.days) return day
  return `${day} ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })}`
}

function onMove(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const r = svg.getBoundingClientRect()
  const sx = ((e.clientX - r.left) / r.width) * W
  let best = -1
  let bestD = Infinity
  props.points.forEach((p, i) => {
    if (p.v === null) return
    const d = Math.abs(geo.value.x(p.t) - sx)
    if (d < bestD) {
      bestD = d
      best = i
    }
  })
  hover.value = best >= 0 ? best : null
}
const hp = computed(() => (hover.value === null ? null : props.points[hover.value]))
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${geo.H}`"
      class="w-full"
      role="img"
      :aria-label="label"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <g v-for="t in geo.yTicks" :key="t">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="geo.y(t)" :y2="geo.y(t)" class="stroke-border" :stroke-width="t === 0 ? 1.5 : 0.5" />
        <text :x="PAD.l - 6" :y="geo.y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">{{ fmt(t) }}</text>
      </g>
      <text
        v-for="(t, i) in geo.xTicks"
        :key="i"
        :x="geo.x(t)"
        :y="geo.H - 6"
        :text-anchor="i === 0 ? 'start' : i === geo.xTicks.length - 1 ? 'end' : 'middle'"
        class="fill-muted-foreground text-[10px]"
      >
        {{ points.length ? xLabel(t) : '' }}
      </text>
      <path v-if="area" :d="geo.area" class="fill-chart-1/15" />
      <g v-for="r in refs" :key="r.label">
        <line
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="geo.y(r.v)"
          :y2="geo.y(r.v)"
          class="stroke-foreground/70"
          stroke-width="1.5"
          stroke-dasharray="6 5"
        />
        <text :x="PAD.l + 6" :y="geo.y(r.v) - 5" class="fill-foreground/80 text-[10px]">{{ r.label }}</text>
      </g>
      <path :d="geo.line" fill="none" class="stroke-chart-1" stroke-width="2" stroke-linejoin="round" />
      <g v-for="(m, i) in markers" :key="i" :transform="`translate(${geo.x(m.t)} ${geo.y(m.v)})`">
        <circle r="7" class="fill-background" />
        <path d="M-4 -4L4 4M4 -4L-4 4" :style="{ stroke: STATUS.critical }" stroke-width="2.4" />
        <title>{{ m.label }}</title>
      </g>
      <g v-if="hp && hp.v !== null">
        <line :x1="geo.x(hp.t)" :x2="geo.x(hp.t)" :y1="PAD.t" :y2="geo.H - PAD.b" class="stroke-muted-foreground/60" stroke-width="1" />
        <circle :cx="geo.x(hp.t)" :cy="geo.y(hp.v)" r="4" class="fill-chart-1 stroke-background" stroke-width="2" />
      </g>
    </svg>
    <div
      v-if="hp && hp.v !== null"
      class="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${(geo.x(hp.t) / W) * 100}%`, transform: `translateX(${geo.x(hp.t) > W * 0.8 ? '-100%' : '-50%'})` }"
    >
      <div class="text-muted-foreground">{{ xLabel(hp.t) }}</div>
      <div class="font-mono tabular-nums">{{ fmt(hp.v) }}</div>
    </div>
  </div>
</template>
