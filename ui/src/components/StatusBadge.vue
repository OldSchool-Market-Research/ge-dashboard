<script setup lang="ts">
// Status chip: fixed status palette + icon + label — state is never color
// alone (dataviz status rule). Covers strategy states, run states and live
// eval verdicts with one vocabulary.
import {
  CheckCircle2Icon,
  CircleDashedIcon,
  CircleDotIcon,
  CircleSlashIcon,
  ClockIcon,
  LoaderIcon,
  SkullIcon,
  TriangleAlertIcon,
} from '@lucide/vue'
import { computed } from 'vue'
import { STATUS } from '@/lib/viz'

const props = defineProps<{ state: string }>()

const spec = computed(() => {
  switch (props.state) {
    case 'confirmed':
    case 'succeeded':
    case 'healthy':
      return { color: STATUS.good, icon: CheckCircle2Icon }
    case 'armed':
      return { color: STATUS.warning, icon: CircleDotIcon }
    case 'degraded':
      return { color: STATUS.warning, icon: TriangleAlertIcon }
    case 'expired':
      return { color: STATUS.serious, icon: ClockIcon }
    case 'killed':
    case 'kill_signal':
    case 'failed':
      return { color: STATUS.critical, icon: SkullIcon }
    case 'vetoed':
      return { color: undefined, icon: CircleSlashIcon }
    case 'running':
      return { color: undefined, icon: LoaderIcon, spin: true }
    default: // open
      return { color: undefined, icon: CircleDashedIcon }
  }
})
</script>

<template>
  <span
    class="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium"
    :style="spec.color ? { borderColor: spec.color, color: spec.color } : {}"
    :class="spec.color ? '' : 'text-muted-foreground'"
  >
    <component :is="spec.icon" class="size-3" :class="spec.spin ? 'animate-spin' : ''" />
    {{ state }}
  </span>
</template>
