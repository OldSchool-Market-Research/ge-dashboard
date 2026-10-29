<script setup lang="ts">
// Every run as one bar, oldest to newest: height = tokens spent, color =
// outcome (shipped / shipped nothing / failed / running). A run with no cost
// record gets a short hatched stub, not a zero. Hover for the run, click to
// open it (the table below the chart is the keyboard path).
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { tokens, type Run } from '@/lib/api'
import { runOutcome, OUTCOME } from '@/lib/runs'

const props = defineProps<{ runs: Run[] }>() // oldest first
const router = useRouter()

const W = 760
const H = 200
const PAD = { l: 44, r: 6, t: 8, b: 4 }
const hover = ref<number | null>(null)

const geo = computed(() => {
  const totals = props.runs.map((r) => (r.input_tokens == null ? null : r.input_tokens + (r.output_tokens ?? 0)))
  const hi = Math.max(1, ...totals.map((t) => t ?? 0)) * 1.05
  const n = Math.max(1, props.runs.length)
  const step = (W - PAD.l - PAD.r) / n
  const bw = Math.max(1, step - 2)
  const y = (v: number) => PAD.t + (1 - v / hi) * (H - PAD.t - PAD.b)
  const bars = props.runs.map((r, i) => {
    const t = totals[i]
    const top = t == null ? H - PAD.b - 6 : Math.min(y(t), H - PAD.b - 2)
    return { x: PAD.l + i * step + 1, top, h: H - PAD.b - top, outcome: runOutcome(r), noCost: t == null, total: t }
  })
  const mag = 10 ** Math.floor(Math.log10(hi / 3))
  const tick = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => hi / s <= 4) ?? mag * 10
  const ticks: number[] = []
  for (let v = 0; v <= hi; v += tick) ticks.push(v)
  return { bars, bw, step, y, ticks }
})

function onMove(e: MouseEvent) {
  const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  const sx = ((e.clientX - r.left) / r.width) * W
  const i = Math.floor((sx - PAD.l) / geo.value.step)
  hover.value = i >= 0 && i < props.runs.length ? i : null
}
function open() {
  if (hover.value !== null) router.push(`/runs/${props.runs[hover.value].run_id}`)
}
const hr = computed(() => (hover.value === null ? null : props.runs[hover.value]))
const summary = computed(() => {
  const c: Record<string, number> = {}
  for (const b of geo.value.bars) c[b.outcome] = (c[b.outcome] ?? 0) + 1
  return Object.entries(c).map(([k, n]) => `${n} ${OUTCOME[k as keyof typeof OUTCOME].label}`).join(', ')
})
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full cursor-pointer"
      role="img"
      :aria-label="`${runs.length} runs by tokens spent: ${summary}`"
      @mousemove="onMove"
      @mouseleave="hover = null"
      @click="open"
    >
      <defs>
        <pattern id="nocost" width="4" height="4" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="4" class="stroke-muted-foreground" stroke-width="1.5" />
        </pattern>
      </defs>
      <g v-for="t in geo.ticks" :key="t">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="geo.y(t)" :y2="geo.y(t)" class="stroke-border" :stroke-width="t === 0 ? 1.5 : 0.5" />
        <text :x="PAD.l - 6" :y="geo.y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">{{ tokens(t) }}</text>
      </g>
      <rect
        v-for="(b, i) in geo.bars"
        :key="runs[i].run_id"
        :x="b.x"
        :y="b.top"
        :width="geo.bw"
        :height="b.h"
        rx="1"
        :style="{ fill: b.noCost ? 'url(#nocost)' : OUTCOME[b.outcome].color, opacity: hover === null || hover === i ? 1 : 0.55 }"
      />
    </svg>
    <div
      v-if="hr"
      class="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${((geo.bars[hover!].x + geo.bw / 2) / W) * 100}%`, transform: `translateX(${geo.bars[hover!].x > W * 0.8 ? '-100%' : '-50%'})` }"
    >
      <div class="font-medium">#{{ hr.run_id }} · {{ OUTCOME[runOutcome(hr)].label }}</div>
      <div class="text-muted-foreground">{{ new Date(hr.started_at).toLocaleString() }}</div>
      <div class="font-mono tabular-nums">{{ geo.bars[hover!].total == null ? 'no cost record' : `${tokens(geo.bars[hover!].total)} tokens` }}</div>
    </div>
  </div>
</template>
