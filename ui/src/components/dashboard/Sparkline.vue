<script setup lang="ts">
import { computed } from 'vue'

// inline trend line — colored via currentColor, so wrap it in a
// text-* utility (e.g. class="text-primary") and size the wrapper.
const props = withDefaults(
  defineProps<{
    data: number[]
    width?: number
    height?: number
    strokeWidth?: number
    /** soft area fill under the line */
    fill?: boolean
  }>(),
  { width: 120, height: 36, strokeWidth: 2, fill: true },
)

const points = computed(() => {
  const { data, width, height, strokeWidth } = props
  if (data.length < 2) return []
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pad = strokeWidth
  return data.map((v, i) => [
    pad + (i / (data.length - 1)) * (width - pad * 2),
    pad + (1 - (v - min) / span) * (height - pad * 2),
  ])
})

const linePath = computed(() =>
  points.value
    .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x!.toFixed(1)} ${y!.toFixed(1)}`)
    .join(' '),
)

const areaPath = computed(() => {
  if (!points.value.length) return ''
  const first = points.value[0]!
  const last = points.value[points.value.length - 1]!
  return `${linePath.value} L${last[0]!.toFixed(1)} ${props.height} L${first[0]!.toFixed(1)} ${props.height} Z`
})
</script>

<template>
  <svg
    :viewBox="`0 0 ${width} ${height}`"
    preserveAspectRatio="none"
    class="h-full w-full"
    aria-hidden="true"
  >
    <path v-if="fill && areaPath" :d="areaPath" class="fill-current opacity-15" />
    <path
      v-if="linePath"
      :d="linePath"
      fill="none"
      class="stroke-current"
      :stroke-width="strokeWidth"
      stroke-linecap="round"
      stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
    />
  </svg>
</template>
