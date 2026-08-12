<script setup lang="ts">
import { CalendarIcon, ClockIcon } from '@lucide/vue'
import { computed } from 'vue'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'

// presentational — wrap it in a RouterLink (class="block h-full") to
// make it navigate; card-hover supplies the affordance.
const props = defineProps<{
  title: string
  excerpt: string
  /** already formatted for display */
  date: string
  tags?: string[]
  readingTime?: string
}>()

// deterministic cover gradient from the title — no images required
const GRADS = [
  'from-emerald-500/30 via-sky-500/15 to-transparent',
  'from-violet-500/30 via-rose-500/15 to-transparent',
  'from-amber-500/30 via-emerald-500/15 to-transparent',
  'from-sky-500/30 via-violet-500/15 to-transparent',
]
const grad = computed(() => {
  let h = 0
  for (const ch of props.title) h = (h * 31 + ch.charCodeAt(0)) | 0
  return GRADS[Math.abs(h) % GRADS.length]
})
</script>

<template>
  <Card class="card-hover h-full gap-3 p-5">
    <div class="relative h-20 overflow-hidden rounded-lg bg-gradient-to-br" :class="grad">
      <span
        class="absolute -right-1 -bottom-4 font-serif text-7xl font-bold text-foreground/10 select-none"
        aria-hidden="true"
      >
        {{ title[0] }}
      </span>
    </div>
    <div v-if="tags?.length" class="flex flex-wrap gap-1.5">
      <Badge v-for="t in tags" :key="t" variant="secondary" class="text-[10px]">{{ t }}</Badge>
    </div>
    <h3 class="text-lg leading-snug font-semibold tracking-tight">{{ title }}</h3>
    <p class="line-clamp-3 text-sm text-muted-foreground">{{ excerpt }}</p>
    <p class="mt-auto flex items-center gap-3 pt-1 text-xs text-muted-foreground">
      <span class="inline-flex items-center gap-1">
        <CalendarIcon class="size-3.5" />
        {{ date }}
      </span>
      <span v-if="readingTime" class="inline-flex items-center gap-1">
        <ClockIcon class="size-3.5" />
        {{ readingTime }}
      </span>
    </p>
  </Card>
</template>
