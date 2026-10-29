<script setup lang="ts">
// Realized gp/hr at each evaluation as baseline bars, against the
// projection as a dashed line (same unit, one axis). A null is "no
// estimate", drawn as nothing; a zero is a real zero and sits on the base.
import { computed, ref } from 'vue'
import { gp } from '@/lib/api'

const props = defineProps<{ points: { t: number; v: number | null }[]; projected: number | null; label: string }>()

const W = 760
const H = 170
const PAD = { l: 52, r: 10, t: 10, b: 4 }
const hover = ref<number | null>(null)

const geo = computed(() => {
  const vals = props.points.map((p) => p.v ?? 0)
  const hi = Math.max(1, ...vals, props.projected ?? 0) * 1.08
  const y = (v: number) => PAD.t + (1 - v / hi) * (H - PAD.t - PAD.b)
  const n = Math.max(1, props.points.length)
  const step = (W - PAD.l - PAD.r) / n
  const bw = Math.max(1, step - (step > 4 ? 1 : 0))
  let d = ''
  props.points.forEach((p, i) => {
    if (!p.v || p.v <= 0) return
    const x = PAD.l + i * step
    d += `M${x.toFixed(1)} ${y(p.v).toFixed(1)}h${bw.toFixed(2)}V${y(0).toFixed(1)}h-${bw.toFixed(2)}Z`
  })
  return { y, step, d, ticks: [0, hi / 2, hi].map((v) => Math.round(v)) }
})

function onMove(e: MouseEvent) {
  const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
  const sx = ((e.clientX - r.left) / r.width) * W
  const i = Math.floor((sx - PAD.l) / geo.value.step)
  hover.value = i >= 0 && i < props.points.length ? i : null
}
const hp = computed(() => (hover.value === null ? null : props.points[hover.value]))
</script>

<template>
  <div class="relative">
    <svg :viewBox="`0 0 ${W} ${H}`" class="w-full" role="img" :aria-label="label" @mousemove="onMove" @mouseleave="hover = null">
      <g v-for="t in geo.ticks" :key="t">
        <line :x1="PAD.l" :x2="W - PAD.r" :y1="geo.y(t)" :y2="geo.y(t)" class="stroke-border" :stroke-width="t === 0 ? 1.5 : 0.5" />
        <text :x="PAD.l - 6" :y="geo.y(t) + 3" text-anchor="end" class="fill-muted-foreground text-[10px] tabular-nums">{{ gp(t) }}</text>
      </g>
      <path :d="geo.d" class="fill-success" />
      <line
        v-if="projected"
        :x1="PAD.l"
        :x2="W - PAD.r"
        :y1="geo.y(projected)"
        :y2="geo.y(projected)"
        class="stroke-foreground/70"
        stroke-width="1.5"
        stroke-dasharray="6 5"
      />
      <rect
        v-if="hover !== null"
        :x="PAD.l + hover * geo.step"
        :y="PAD.t"
        :width="Math.max(2, geo.step)"
        :height="H - PAD.t - PAD.b"
        class="fill-foreground/10"
      />
    </svg>
    <div
      v-if="hp"
      class="pointer-events-none absolute top-0 rounded-md border bg-popover px-2 py-1 text-xs text-popover-foreground shadow-md"
      :style="{ left: `${((PAD.l + (hover ?? 0) * geo.step) / W) * 100}%`, transform: 'translateX(-50%)' }"
    >
      <div class="text-muted-foreground">{{ new Date(hp.t).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) }}</div>
      <div class="font-mono tabular-nums">{{ hp.v === null ? 'no estimate' : `${gp(hp.v)}/hr` }}</div>
    </div>
  </div>
</template>
