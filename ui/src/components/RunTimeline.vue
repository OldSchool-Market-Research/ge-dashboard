<script setup lang="ts">
// Every run in the window at its real time, one lane per mode: width is how long
// it took (with a floor so a 1-minute run stays visible), color is the outcome.
// Gaps read as the idle time they are. Hover for the run, click to open it (the
// table below the chart is the keyboard path).
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { duration, tokens, type Run } from '@/lib/api'
import { OUTCOME, runOutcome } from '@/lib/runs'

const props = defineProps<{ runs: Run[]; from: number; to: number }>()
const router = useRouter()

const W = 960
const PAD = { l: 66, r: 8, t: 6, b: 22 }
const LANE_H = 34
const LANE_GAP = 8
const MIN_W = 3
const LANES = ['research', 'evaluate'] as const
const H = PAD.t + LANES.length * LANE_H + (LANES.length - 1) * LANE_GAP + PAD.b

const x = (t: number) => PAD.l + ((t - props.from) / Math.max(1, props.to - props.from)) * (W - PAD.l - PAD.r)
const laneY = (i: number) => PAD.t + i * (LANE_H + LANE_GAP)

const hover = ref<number | null>(null)

const bars = computed(() =>
  props.runs.map((r) => {
    const start = Date.parse(r.started_at)
    const end = r.finished_at ? Date.parse(r.finished_at) : props.to
    const lane = Math.max(0, LANES.indexOf((r.mode ?? 'research') as (typeof LANES)[number]))
    const x0 = Math.max(PAD.l, x(start))
    return { r, x: x0, w: Math.max(MIN_W, x(end) - x0), y: laneY(lane), outcome: runOutcome(r) }
  }),
)

const ticks = computed(() => {
  const hours = (props.to - props.from) / 3600_000
  const stepH = hours <= 26 ? 4 : hours <= 80 ? 12 : 24
  const step = stepH * 3600_000
  const out: number[] = []
  // aligned to local clock hours, so the labels read as round times
  const offset = new Date(props.from).getTimezoneOffset() * 60_000
  for (let t = Math.ceil((props.from - offset) / step) * step + offset; t <= props.to; t += step) out.push(t)
  return out
})

function tickLabel(t: number): string {
  const d = new Date(t)
  const hours = (props.to - props.from) / 3600_000
  if (hours > 80) return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const clock = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  return hours <= 26 ? clock : `${d.toLocaleDateString(undefined, { weekday: 'short' })} ${clock}`
}

const hb = computed(() => (hover.value === null ? null : bars.value[hover.value]))
const shippedCount = (r: Run) => (r.shipped ?? []).filter((s) => s.state !== 'vetoed').length
const summary = computed(() => {
  const c: Record<string, number> = {}
  for (const b of bars.value) c[b.outcome] = (c[b.outcome] ?? 0) + 1
  return Object.entries(c).map(([k, n]) => `${n} ${OUTCOME[k as keyof typeof OUTCOME].label}`).join(', ')
})
</script>

<template>
  <div class="relative">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="`${runs.length} runs over time: ${summary}`">
      <g v-for="(lane, i) in LANES" :key="lane">
        <rect :x="PAD.l" :y="laneY(i)" :width="W - PAD.l - PAD.r" :height="LANE_H" class="fill-muted/40" />
        <text :x="PAD.l - 8" :y="laneY(i) + LANE_H / 2 + 3" text-anchor="end" class="fill-muted-foreground text-[11px]">{{ lane }}</text>
      </g>
      <g v-for="t in ticks" :key="t">
        <line :x1="x(t)" :x2="x(t)" :y1="PAD.t" :y2="H - PAD.b" class="stroke-border" stroke-width="0.5" />
        <text :x="x(t)" :y="H - 7" text-anchor="middle" class="fill-muted-foreground text-[10px]">{{ tickLabel(t) }}</text>
      </g>
      <g v-for="(b, i) in bars" :key="b.r.run_id">
        <rect
          :x="b.x"
          :y="b.y + 4"
          :width="b.w"
          :height="LANE_H - 8"
          rx="1"
          :style="{ fill: OUTCOME[b.outcome].color, opacity: hover === null || hover === i ? 1 : 0.55 }"
          :class="b.outcome === 'running' ? 'animate-pulse' : ''"
        />
        <!-- hit target wider than the mark -->
        <rect
          :x="b.x - 3"
          :y="b.y"
          :width="b.w + 6"
          :height="LANE_H"
          fill="transparent"
          class="cursor-pointer"
          @mouseenter="hover = i"
          @mouseleave="hover = null"
          @click="router.push(`/runs/${b.r.run_id}`)"
        />
      </g>
    </svg>
    <div
      v-if="hb"
      class="pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${((hb.x + hb.w / 2) / W) * 100}%`, top: '100%', transform: `translateX(${hb.x > W * 0.8 ? '-100%' : hb.x < W * 0.2 ? '0' : '-50%'})` }"
    >
      <div class="font-medium">#{{ hb.r.run_id }} · {{ hb.r.mode }} · {{ OUTCOME[hb.outcome].label }}</div>
      <div class="text-muted-foreground">{{ new Date(hb.r.started_at).toLocaleString() }} · took {{ duration(hb.r.started_at, hb.r.finished_at) }}</div>
      <div class="font-mono tabular-nums">
        {{ hb.r.input_tokens == null ? 'no cost record' : `${tokens(hb.r.input_tokens + (hb.r.output_tokens ?? 0))} tokens` }} · {{ shippedCount(hb.r) }} shipped
      </div>
    </div>
  </div>
</template>
