<script setup lang="ts">
// Every closed strategy as one dot: projected gp across, realized gp up,
// both on the same log scale, so the dashed diagonal is "earned what it
// promised". Strategies that realized nothing or lost money can't sit on a
// log axis; they get their own strip under the plot (losses lower in it).
// Lane = color AND shape (C circle, F square, others diamond). Hover for
// the strategy, click to open it.
import { useTheme } from '@fisherrjd/ui/theme'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { gp } from '@/lib/api'
import { archetypeColor } from '@/lib/viz'

export interface ScatterPoint {
  id: number
  archetype: string
  title: string
  projected: number
  realized: number
}

const props = defineProps<{ points: ScatterPoint[] }>()
const router = useRouter()
const { mode } = useTheme()

const W = 760
const PLOT_H = 360
const STRIP = 36
const PAD = { l: 52, r: 12, t: 10, b: 24 }
const H = PLOT_H + STRIP + PAD.b
const hover = ref<number | null>(null)

const geo = computed(() => {
  const vals = props.points.flatMap((p) => [p.projected, p.realized]).filter((v) => v > 0)
  const lo = Math.floor(Math.log10(Math.max(1, Math.min(1000, ...vals))))
  const hi = Math.ceil(Math.log10(Math.max(10_000, ...vals)))
  const sx = (v: number) => PAD.l + ((Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * (W - PAD.l - PAD.r)
  const sy = (v: number) => PAD.t + (1 - (Math.log10(Math.max(v, 10 ** lo)) - lo) / (hi - lo)) * (PLOT_H - PAD.t)
  const decades = Array.from({ length: hi - lo + 1 }, (_, i) => 10 ** (lo + i))
  const dark = mode.value === 'dark'
  const dots = props.points.map((p) => ({
    ...p,
    x: sx(p.projected),
    y: p.realized > 0 ? sy(p.realized) : PLOT_H + (p.realized < 0 ? STRIP * 0.72 : STRIP * 0.32),
    color: archetypeColor(p.archetype, dark),
  }))
  return { sx, sy, decades, dots, lo, hi }
})

const counts = computed(() => ({
  beat: props.points.filter((p) => p.realized > 0 && p.realized >= p.projected).length,
  zero: props.points.filter((p) => p.realized <= 0).length,
}))

const hp = computed(() => (hover.value === null ? null : geo.value.dots[hover.value]))
</script>

<template>
  <div class="relative">
    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      role="img"
      :aria-label="`${points.length} closed strategies, projected against realized gp on log scales: ${counts.beat} beat their projection, ${counts.zero} realized nothing or lost`"
    >
      <g v-for="d in geo.decades" :key="d">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="geo.sy(d)" :y2="geo.sy(d)" class="stroke-border" stroke-width="0.5" />
        <line :x1="geo.sx(d)" :x2="geo.sx(d)" :y1="PAD.t" :y2="PLOT_H + STRIP" class="stroke-border" stroke-width="0.5" />
        <text :x="PAD.l - 6" :y="geo.sy(d) + 3" text-anchor="end" class="fill-muted-foreground text-[10px]">{{ gp(d) }}</text>
        <text :x="geo.sx(d)" :y="H - 6" text-anchor="middle" class="fill-muted-foreground text-[10px]">{{ gp(d) }}</text>
      </g>
      <rect :x="PAD.l" :y="PLOT_H" :width="W - PAD.l - PAD.r" :height="STRIP" class="fill-destructive/10" />
      <text :x="PAD.l - 6" :y="PLOT_H + STRIP / 2 + 3" text-anchor="end" class="fill-muted-foreground text-[10px]">≤ 0</text>
      <line
        :x1="geo.sx(10 ** geo.lo)"
        :y1="geo.sy(10 ** geo.lo)"
        :x2="geo.sx(10 ** geo.hi)"
        :y2="geo.sy(10 ** geo.hi)"
        class="stroke-foreground/60"
        stroke-width="1.5"
        stroke-dasharray="6 5"
      />
      <text :x="W - PAD.r - 4" :y="PAD.t + 12" text-anchor="end" class="fill-muted-foreground text-[10px]">realized = projected</text>
      <g
        v-for="(d, i) in geo.dots"
        :key="d.id"
        class="cursor-pointer"
        @mouseenter="hover = i"
        @mouseleave="hover = null"
        @click="router.push(`/book/${d.id}`)"
      >
        <circle :cx="d.x" :cy="d.y" r="9" fill="transparent" />
        <circle v-if="d.archetype === 'C'" :cx="d.x" :cy="d.y" r="4.5" class="stroke-card" stroke-width="1.5" :style="{ fill: d.color }" />
        <rect v-else-if="d.archetype === 'F'" :x="d.x - 4" :y="d.y - 4" width="8" height="8" class="stroke-card" stroke-width="1.5" :style="{ fill: d.color }" />
        <path v-else :d="`M${d.x} ${d.y - 5}L${d.x + 5} ${d.y}L${d.x} ${d.y + 5}L${d.x - 5} ${d.y}Z`" class="stroke-card" stroke-width="1.5" :style="{ fill: d.color }" />
      </g>
    </svg>
    <div
      v-if="hp"
      class="pointer-events-none absolute max-w-72 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${(hp.x / W) * 100}%`, top: `${(hp.y / H) * 100}%`, transform: `translate(${hp.x > W * 0.7 ? '-105%' : '8px'}, -50%)` }"
    >
      <div class="font-medium">{{ hp.archetype }} #{{ hp.id }} · {{ hp.title }}</div>
      <div class="font-mono tabular-nums">projected {{ gp(hp.projected) }} · realized {{ gp(hp.realized) }}</div>
    </div>
  </div>
</template>
