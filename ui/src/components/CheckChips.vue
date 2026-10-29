<script setup lang="ts">
// The evaluator's checks as plain-English chips, failing first: a check
// mark or a cross plus words, never color alone.
import { CheckIcon, XIcon } from '@lucide/vue'
import { computed } from 'vue'
import { checkLines } from '@/lib/strategy'

const props = defineProps<{ checks: Record<string, boolean> | null | undefined }>()
const lines = computed(() => checkLines(props.checks))
</script>

<template>
  <ul v-if="lines.length" class="flex flex-wrap gap-1.5">
    <li
      v-for="c in lines"
      :key="c.key"
      class="inline-flex items-center gap-1 border px-2 py-0.5 text-xs"
      :class="c.ok ? 'border-success/40 text-success' : 'border-destructive/50 text-destructive'"
      :title="c.key"
    >
      <CheckIcon v-if="c.ok" class="size-3" aria-hidden="true" />
      <XIcon v-else class="size-3" aria-hidden="true" />
      {{ c.text }}
    </li>
  </ul>
</template>
