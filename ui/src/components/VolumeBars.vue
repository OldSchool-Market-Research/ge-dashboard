<script setup lang="ts">
// Units traded per bucket over the same window as the price chart: one
// series (total volume), baseline-anchored bars with a rounded data-end and
// a 2px surface gap, recessive grid. Per-bar hover tooltip carries the
// insta-buy / insta-sell split. Its own chart and axis (never dual-axis
// with price).
import { computed, ref } from 'vue'
import { gp, type ItemHistoryPoint } from '@/lib/api'
import { DIVERGING } from '@/lib/viz'

const props = defineProps<{ points: ItemHistoryPoint[]; days: number; bucketMinutes: number }>()

const W = 720
const H = 120
const PAD = { l: 52, r: 12, t: 8, b: 6 }
const MIN = 60_000

const scale = computed(() => {
  const t1 = Date.now()
  const t0 = t1 - props.days * 24 * 60 * MIN
  const max = Math.max(1, ...props.points.map((p) => p.high_vol + p.low_vol))
  const plotW = W - PAD.l - PAD.r
  const slotW = (props.bucketMinutes * MIN * plotW) / (t1 - t0)
  const barW = Math.max(1, Math.min(24, slotW - 2)) // 2px surface gap
  return { t0, t1, max, barW, plotW }
})

function x(iso: string) {
  const { t0, t1, plotW } = scale.value
  return PAD.l + ((new Date(iso).getTime() - t0) / (t1 - t0)) * plotW
}
function y(v: number) {
  return PAD.t + (1 - v / scale.value.max) * (H - PAD.t - PAD.b)
}
const base = computed(() => y(0))

// bar with a rounded data-end, flat at the baseline
function barPath(p: ItemHistoryPoint) {
  const v = p.high_vol + p.low_vol
  const { barW } = scale.value
  const x0 = x(p.bucket)
  const top = Math.min(y(v), base.value - 1)
  const r = Math.min(2, barW / 2, base.value - top)
  return `M${x0},${base.value} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${base.value} Z`
}

const hover = ref<ItemHistoryPoint | null>(null)
</script>

<template>
  <div class="relative">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="`units traded per bucket over the last ${days} days`" @mouseleave="hover = null">
      <line :x1="PAD.l" :x2="W - PAD.r" :y1="y(scale.max)" :y2="y(scale.max)" class="stroke-border" stroke-width="0.5" />
      <text :x="PAD.l - 5" :y="y(scale.max) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">{{ gp(scale.max) }}</text>
      <line :x1="PAD.l" :x2="W - PAD.r" :y1="base" :y2="base" class="stroke-border" stroke-width="0.5" />
      <text :x="PAD.l - 5" :y="base + 3" text-anchor="end" class="fill-muted-foreground text-[10px]">0</text>
      <path
        v-for="p in points.filter((q) => q.high_vol + q.low_vol > 0)"
        :key="p.bucket"
        :d="barPath(p)"
        :style="{ fill: DIVERGING.pos, opacity: hover && hover.bucket !== p.bucket ? 0.5 : 1 }"
        @mouseenter="hover = p"
      />
    </svg>
    <div
      v-if="hover"
      class="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${(x(hover.bucket) / W) * 100}%`, transform: 'translateX(-50%)' }"
    >
      <div class="font-medium tabular-nums">{{ (hover.high_vol + hover.low_vol).toLocaleString() }} traded</div>
      <div class="text-muted-foreground tabular-nums">
        {{ hover.high_vol.toLocaleString() }} insta-buy · {{ hover.low_vol.toLocaleString() }} insta-sell
      </div>
      <div class="text-muted-foreground">{{ new Date(hover.bucket).toISOString().slice(5, 16).replace('T', ' ') }} UTC</div>
    </div>
  </div>
</template>
