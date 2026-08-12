<script setup lang="ts">
// Hero-number tile (dataviz: sometimes the answer is not a chart). Value
// wears text tokens; an optional signed accent colors ONLY the delta dot.
import { computed } from 'vue'
import { Card, CardContent } from '@/components/ui/card'
import { useTheme } from '@/composables/useTheme'
import { DIVERGING } from '@/lib/viz'

const props = defineProps<{
  label: string
  value: string
  hint?: string
  signed?: number | null
}>()

const { mode } = useTheme()
const accent = computed(() => {
  if (props.signed === null || props.signed === undefined || props.signed === 0) return undefined
  const d = mode.value === 'dark' ? DIVERGING.dark : DIVERGING.light
  return props.signed > 0 ? d.pos : d.neg
})
</script>

<template>
  <Card>
    <CardContent class="px-4 py-3">
      <div class="text-xs text-muted-foreground">{{ label }}</div>
      <div class="mt-1 flex items-baseline gap-2">
        <span v-if="accent" class="size-2 shrink-0 rounded-full" :style="{ background: accent }" />
        <span class="text-2xl font-semibold tabular-nums tracking-tight">{{ value }}</span>
      </div>
      <div v-if="hint" class="mt-0.5 text-xs text-muted-foreground">{{ hint }}</div>
    </CardContent>
  </Card>
</template>
