<script setup lang="ts">
// Calibration factors over time: one 2px line per archetype (fixed
// categorical hue order — identity follows the archetype across filters),
// legend always present, direct label at each line's end, epoch-2 cut for F
// drawn as a reference line. Crosshair tooltip on hover.
import { computed, ref } from 'vue'
import { useTheme } from '@/composables/useTheme'
import type { CalibrationRow } from '@/lib/api'
import { ARCHETYPE_ORDER, archetypeColor } from '@/lib/viz'

const props = defineProps<{ history: CalibrationRow[] }>()
const { mode } = useTheme()
const dark = computed(() => mode.value === 'dark')

const W = 720
const H = 240
const PAD = { l: 36, r: 44, t: 10, b: 22 }

const series = computed(() => {
  const by = new Map<string, CalibrationRow[]>()
  for (const r of props.history) {
    if (!by.has(r.archetype)) by.set(r.archetype, [])
    by.get(r.archetype)!.push(r)
  }
  return ARCHETYPE_ORDER.filter((a) => by.has(a)).map((a) => ({
    archetype: a,
    color: archetypeColor(a, dark.value),
    rows: by.get(a)!.sort((x, y) => x.computed_at.localeCompare(y.computed_at)),
  }))
})

const domain = computed(() => {
  const ts = props.history.map((r) => new Date(r.computed_at).getTime())
  const t0 = Math.min(...ts)
  const t1 = Math.max(...ts)
  const fMax = Math.max(0.5, ...props.history.map((r) => r.factor))
  return { t0, t1: t1 === t0 ? t0 + 1 : t1, fMax }
})

function x(iso: string): number {
  const { t0, t1 } = domain.value
  return PAD.l + ((new Date(iso).getTime() - t0) / (t1 - t0)) * (W - PAD.l - PAD.r)
}
function y(f: number): number {
  return PAD.t + (1 - f / domain.value.fMax) * (H - PAD.t - PAD.b)
}

function linePath(rows: CalibrationRow[]): string {
  return rows.map((r, i) => `${i ? 'L' : 'M'}${x(r.computed_at).toFixed(1)},${y(r.factor).toFixed(1)}`).join(' ')
}

// F's epoch-2 cut: the moment measurement regimes changed (fill-sim live).
const epochCut = computed(() => {
  const f2 = props.history
    .filter((r) => r.archetype === 'F' && r.epoch >= 2)
    .sort((a, b) => a.computed_at.localeCompare(b.computed_at))[0]
  return f2 ? x(f2.computed_at) : null
})

const hover = ref<{ px: number; rows: { archetype: string; color: string; factor: number }[]; when: string } | null>(null)

function onMove(e: MouseEvent) {
  const svg = e.currentTarget as SVGSVGElement
  const rect = svg.getBoundingClientRect()
  const px = ((e.clientX - rect.left) / rect.width) * W
  const t = domain.value.t0 + ((px - PAD.l) / (W - PAD.l - PAD.r)) * (domain.value.t1 - domain.value.t0)
  const rows = series.value.flatMap((s) => {
    let best: CalibrationRow | undefined
    for (const r of s.rows) {
      if (
        !best ||
        Math.abs(new Date(r.computed_at).getTime() - t) < Math.abs(new Date(best.computed_at).getTime() - t)
      )
        best = r
    }
    return best ? [{ archetype: s.archetype, color: s.color, factor: best.factor }] : []
  })
  const when = new Date(t).toISOString().slice(5, 10)
  hover.value = { px: Math.max(PAD.l, Math.min(W - PAD.r, px)), rows, when }
}
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      role="img"
      aria-label="Calibration factor per archetype over time"
      @mousemove="onMove"
      @mouseleave="hover = null"
    >
      <g v-for="t in [0, 0.25, 0.5, 0.75, 1]" :key="t">
        <line v-if="t <= domain.fMax" :x1="PAD.l" :x2="W - PAD.r" :y1="y(t)" :y2="y(t)" class="stroke-border" stroke-width="0.5" />
        <text v-if="t <= domain.fMax" :x="PAD.l - 5" :y="y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">
          {{ t }}
        </text>
      </g>
      <!-- F epoch-2 cut: measurement regime break, annotated not hidden -->
      <g v-if="epochCut !== null">
        <line :x1="epochCut" :x2="epochCut" :y1="PAD.t" :y2="H - PAD.b" class="stroke-muted-foreground" stroke-width="1" stroke-dasharray="3 3" />
        <text :x="epochCut + 4" :y="PAD.t + 8" class="fill-muted-foreground text-[9px]">fill-sim epoch</text>
      </g>
      <g v-for="s in series" :key="s.archetype">
        <path :d="linePath(s.rows)" fill="none" :stroke="s.color" stroke-width="2" stroke-linejoin="round" />
        <text
          :x="x(s.rows[s.rows.length - 1].computed_at) + 5"
          :y="y(s.rows[s.rows.length - 1].factor) + 3"
          class="text-[10px] font-medium"
          :fill="s.color"
        >
          {{ s.archetype }}
        </text>
      </g>
      <line v-if="hover" :x1="hover.px" :x2="hover.px" :y1="PAD.t" :y2="H - PAD.b" class="stroke-muted-foreground" stroke-width="0.75" />
    </svg>
    <div
      v-if="hover"
      class="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${(hover.px / W) * 100}%`, transform: 'translateX(-50%)' }"
    >
      <div class="font-medium">{{ hover.when }}</div>
      <div v-for="r in hover.rows" :key="r.archetype" class="flex items-center gap-1.5 tabular-nums">
        <span class="size-2 rounded-[2px]" :style="{ background: r.color }" />
        {{ r.archetype }} {{ r.factor.toFixed(2) }}
      </div>
    </div>
    <!-- legend: always present for >= 2 series -->
    <div class="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
      <span v-for="s in series" :key="s.archetype" class="inline-flex items-center gap-1.5">
        <span class="h-0.5 w-4 rounded-full" :style="{ background: s.color }" />
        {{ s.archetype }}
      </span>
    </div>
  </div>
</template>
