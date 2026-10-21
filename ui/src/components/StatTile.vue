<script setup lang="ts">
// Hero-number tile (dataviz: sometimes the answer is not a chart). Value
// wears text tokens; an optional signed accent colors ONLY the delta dot.
import { Card, CardContent } from '@fisherrjd/ui/card'
import { computed } from 'vue'
import { DIVERGING } from '@/lib/viz'

const props = defineProps<{
  label: string
  value: string
  hint?: string
  signed?: number | null
}>()

const accent = computed(() => {
  if (props.signed === null || props.signed === undefined || props.signed === 0) return undefined
  return props.signed > 0 ? DIVERGING.pos : DIVERGING.neg
})
</script>

<template>
  <Card>
    <CardContent class="px-4 py-3">
      <div class="truncate font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{{ label }}</div>
      <div class="mt-1.5 flex items-baseline gap-2">
        <span v-if="accent" class="size-2 shrink-0 rounded-full" :style="{ background: accent }" />
        <span class="truncate font-mono text-2xl font-medium tabular-nums tracking-tight">{{ value }}</span>
      </div>
      <div v-if="hint" class="mt-0.5 truncate text-xs text-muted-foreground">{{ hint }}</div>
    </CardContent>
  </Card>
</template>
