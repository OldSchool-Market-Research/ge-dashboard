<script setup lang="ts">
// Signed daily paper P&L: bars from a zero baseline, diverging pair
// (blue = made gp, red = lost gp — poles from the validated palette; the
// neutral midpoint is the surface). Marks per the dataviz spec: baseline-
// anchored bars with a rounded data-end, 2px gaps, recessive grid, per-bar
// hover tooltip. One series — the title names it, no legend box.
import { computed, ref } from 'vue'
import { useTheme } from '@/composables/useTheme'
import { gp } from '@/lib/api'
import { DIVERGING } from '@/lib/viz'

const props = defineProps<{ days: { day: string; gp: number; n: number }[] }>()
const { mode } = useTheme()
const pair = computed(() => (mode.value === 'dark' ? DIVERGING.dark : DIVERGING.light))

const W = 720
const H = 220
const PAD = { l: 44, r: 8, t: 10, b: 22 }

const hover = ref<number | null>(null)

const scale = computed(() => {
  const vals = props.days.map((d) => d.gp)
  const max = Math.max(1, ...vals)
  const min = Math.min(0, ...vals)
  const span = max - min || 1
  const plotH = H - PAD.t - PAD.b
  const y = (v: number) => PAD.t + ((max - v) / span) * plotH
  const plotW = W - PAD.l - PAD.r
  const step = plotW / Math.max(1, props.days.length)
  const barW = Math.max(2, Math.min(28, step - 2)) // 2px surface gap between bars
  const x = (i: number) => PAD.l + i * step + (step - barW) / 2
  return { y, x, barW, max, min, zero: y(0) }
})

// bar with a 4px rounded data-end, flat at the baseline
function barPath(i: number, v: number): string {
  const { x, y, barW, zero } = scale.value
  const x0 = x(i)
  const r = Math.min(4, barW / 2)
  const yv = y(v)
  if (v >= 0) {
    const top = Math.min(yv, zero - 1)
    return `M${x0},${zero} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${zero} Z`
  }
  const bot = Math.max(yv, zero + 1)
  return `M${x0},${zero} V${bot - r} Q${x0},${bot} ${x0 + r},${bot} H${x0 + barW - r} Q${x0 + barW},${bot} ${x0 + barW},${bot - r} V${zero} Z`
}

const ticks = computed(() => {
  const { max, min } = scale.value
  const range = max - min
  const step = 10 ** Math.floor(Math.log10(range || 1))
  const nice = range / step > 5 ? step * 2 : step
  const out: number[] = []
  for (let v = Math.ceil(min / nice) * nice; v <= max; v += nice) out.push(v)
  return out
})
</script>

<template>
  <div class="relative">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" aria-label="Daily realized paper gp">
      <!-- recessive grid + y labels -->
      <g v-for="t in ticks" :key="t">
        <line
          :x1="PAD.l"
          :x2="W - PAD.r"
          :y1="scale.y(t)"
          :y2="scale.y(t)"
          class="stroke-border"
          :stroke-width="t === 0 ? 1.5 : 0.5"
        />
        <text
          :x="PAD.l - 6"
          :y="scale.y(t) + 3"
          text-anchor="end"
          class="fill-muted-foreground text-[10px] tabular-nums"
        >
          {{ gp(t) }}
        </text>
      </g>
      <!-- bars -->
      <g v-for="(d, i) in days" :key="d.day">
        <path :d="barPath(i, d.gp)" :fill="d.gp >= 0 ? pair.pos : pair.neg" />
        <!-- hit target wider than the mark -->
        <rect
          :x="scale.x(i) - 2"
          :y="PAD.t"
          :width="scale.barW + 4"
          :height="H - PAD.t - PAD.b"
          fill="transparent"
          @mouseenter="hover = i"
          @mouseleave="hover = null"
        />
        <text
          v-if="i % Math.ceil(days.length / 8) === 0"
          :x="scale.x(i) + scale.barW / 2"
          :y="H - 6"
          text-anchor="middle"
          class="fill-muted-foreground text-[10px]"
        >
          {{ d.day.slice(5) }}
        </text>
      </g>
    </svg>
    <div
      v-if="hover !== null && days[hover]"
      class="pointer-events-none absolute rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{
        left: `${((scale.x(hover) + scale.barW / 2) / W) * 100}%`,
        top: '0px',
        transform: 'translateX(-50%)',
      }"
    >
      <div class="font-medium">{{ days[hover].day }}</div>
      <div class="tabular-nums">{{ gp(days[hover].gp) }} gp · {{ days[hover].n }} closed</div>
    </div>
  </div>
</template>
