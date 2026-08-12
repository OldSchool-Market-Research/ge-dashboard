<script setup lang="ts">
import { computed } from 'vue'
import { daysSince, freshness, relativeDays } from '@/lib/activity'

// reality signal: green = active lately, amber = cooling, grey = dormant.
// renders nothing when there's no date — absence of signal, not an error.
const props = withDefaults(
  defineProps<{
    /** last-activity timestamp (ISO or Date) */
    date?: string | Date | null
    /** tooltip verb, e.g. "pushed" for repos */
    verb?: string
  }>(),
  { verb: 'active' },
)

const days = computed(() => daysSince(props.date))
const level = computed(() => freshness(days.value))
const title = computed(() =>
  level.value ? `${level.value} — ${relativeDays(days.value, props.verb)}` : '',
)

const DOT = {
  fresh: 'bg-emerald-500',
  cooling: 'bg-amber-500',
  dormant: 'bg-stone-400',
}
</script>

<template>
  <span v-if="level" class="size-2 shrink-0 rounded-full" :class="DOT[level]" :title="title" />
</template>
