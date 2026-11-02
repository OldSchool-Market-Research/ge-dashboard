<script setup lang="ts">
// Long windows: too many runs to draw one by one, so runs per UTC day, stacked by
// outcome. Same outcome colors as the timeline; per-bar hover for the counts.
import { computed, ref } from 'vue'
import type { Run } from '@/lib/api'
import { OUTCOME, runOutcome, type Outcome as RunOutcome } from '@/lib/runs'

const props = defineProps<{ runs: Run[] }>()

const ORDER: RunOutcome[] = ['shipped', 'empty', 'vetoed', 'failed', 'running']
const W = 960
const H = 200
const PAD = { l: 34, r: 8, t: 8, b: 22 }
const GAP = 1 // surface gap between stacked segments

const hover = ref<number | null>(null)

const days = computed(() => {
  const by = new Map<string, Record<RunOutcome, number>>()
  for (const r of props.runs) {
    const day = new Date(r.started_at).toISOString().slice(0, 10)
    const c = by.get(day) ?? { shipped: 0, vetoed: 0, empty: 0, failed: 0, running: 0 }
    c[runOutcome(r)]++
    by.set(day, c)
  }
  if (!by.size) return []
  // every day in the span gets a slot: a day with no runs is a visible gap
  const sorted = [...by.keys()].sort()
  const out: { day: string; c: Record<RunOutcome, number>; total: number }[] = []
  for (let t = Date.parse(`${sorted[0]}T00:00:00Z`); t <= Date.parse(`${sorted.at(-1)}T00:00:00Z`); t += 86400_000) {
    const day = new Date(t).toISOString().slice(0, 10)
    const c = by.get(day) ?? { shipped: 0, vetoed: 0, empty: 0, failed: 0, running: 0 }
    out.push({ day, c, total: ORDER.reduce((s, k) => s + c[k], 0) })
  }
  return out
})

const geo = computed(() => {
  const max = Math.max(1, ...days.value.map((d) => d.total))
  const plotH = H - PAD.t - PAD.b
  const step = (W - PAD.l - PAD.r) / Math.max(1, days.value.length)
  const barW = Math.max(1, Math.min(24, step - 2))
  const mag = 10 ** Math.floor(Math.log10(max))
  const tick = [1, 2, 5, 10].map((m) => m * mag).find((s) => max / s <= 4) ?? mag * 10
  const ticks: number[] = []
  for (let v = 0; v <= max; v += tick) ticks.push(v)
  const y = (v: number) => PAD.t + (1 - v / max) * plotH
  const bars = days.value.map((d, i) => {
    let acc = 0
    const segs = ORDER.filter((k) => d.c[k] > 0).map((k) => {
      const top = y(acc + d.c[k])
      const bottom = y(acc)
      acc += d.c[k]
      return { k, y: top, h: Math.max(1, bottom - top - GAP) }
    })
    return { d, x: PAD.l + i * step + (step - barW) / 2, segs }
  })
  return { barW, step, y, ticks, bars }
})

const hd = computed(() => (hover.value === null ? null : geo.value.bars[hover.value]))
const labelEvery = computed(() => Math.max(1, Math.ceil(days.value.length / 10)))
</script>

<template>
  <div class="relative">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="`Runs per day over ${days.length} days, by outcome`">
      <g v-for="t in geo.ticks" :key="t">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="geo.y(t)" :y2="geo.y(t)" class="stroke-border" :stroke-width="t === 0 ? 1.5 : 0.5" />
        <text :x="PAD.l - 6" :y="geo.y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">{{ t }}</text>
      </g>
      <g v-for="(b, i) in geo.bars" :key="b.d.day">
        <rect v-for="s in b.segs" :key="s.k" :x="b.x" :y="s.y" :width="geo.barW" :height="s.h" :style="{ fill: OUTCOME[s.k].color, opacity: hover === null || hover === i ? 1 : 0.55 }" />
        <rect :x="b.x - 1" :y="PAD.t" :width="geo.barW + 2" :height="H - PAD.t - PAD.b" fill="transparent" @mouseenter="hover = i" @mouseleave="hover = null" />
        <text v-if="i % labelEvery === 0" :x="b.x + geo.barW / 2" :y="H - 7" text-anchor="middle" class="fill-muted-foreground text-[10px]">{{ b.d.day.slice(5) }}</text>
      </g>
    </svg>
    <div
      v-if="hd"
      class="pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${((hd.x + geo.barW / 2) / W) * 100}%`, top: '0', transform: `translateX(${hd.x > W * 0.8 ? '-100%' : '-50%'})` }"
    >
      <div class="font-medium">{{ hd.d.day }} · {{ hd.d.total }} runs</div>
      <div v-for="k in ORDER.filter((o) => hd!.d.c[o] > 0)" :key="k" class="text-muted-foreground">{{ hd.d.c[k] }} {{ OUTCOME[k].label }}</div>
    </div>
  </div>
</template>
