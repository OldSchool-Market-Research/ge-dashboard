<script setup lang="ts">
import { computed } from 'vue'

// dot + label pill for anything with a lifecycle: PRs, checks, tasks.
// unknown statuses fall back to a neutral dot, so it's safe for API data.
const props = defineProps<{
  status: string
  /** display text; defaults to the status with dashes as spaces */
  label?: string
}>()

const dots: Record<string, string> = {
  open: 'bg-emerald-500',
  passing: 'bg-emerald-500',
  done: 'bg-emerald-500',
  merged: 'bg-violet-500',
  'in-progress': 'bg-sky-500',
  pending: 'bg-amber-500',
  review: 'bg-amber-500',
  failing: 'bg-red-500',
  blocked: 'bg-red-500',
  closed: 'bg-red-500',
  draft: 'bg-muted-foreground',
  todo: 'bg-muted-foreground',
}

const dot = computed(() => dots[props.status] ?? 'bg-muted-foreground')
const text = computed(() => props.label ?? props.status.replace(/-/g, ' '))
</script>

<template>
  <span
    class="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium capitalize"
  >
    <span class="size-1.5 rounded-full" :class="dot" />
    {{ text }}
  </span>
</template>
