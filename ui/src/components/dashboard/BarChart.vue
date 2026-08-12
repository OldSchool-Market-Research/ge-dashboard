<script setup lang="ts">
import { computed } from 'vue'

// dependency-free bar chart: bars grow in on mount, values show on hover.
// swap the data array (with new labels) and it re-animates.
const props = withDefaults(
  defineProps<{
    data: { label: string; value: number }[]
    /** bar area height in px */
    height?: number
    format?: (n: number) => string
  }>(),
  { height: 180, format: (n: number) => n.toLocaleString('en-US') },
)

const max = computed(() => Math.max(...props.data.map((d) => d.value), 1))
</script>

<template>
  <div>
    <div class="flex items-end gap-2" :style="{ height: `${height}px` }">
      <div
        v-for="(d, i) in data"
        :key="d.label"
        class="flex h-full flex-1 flex-col justify-end"
      >
        <div
          class="bar group relative rounded-t-md bg-gradient-to-t from-primary/55 to-primary/90 hover:from-primary hover:to-primary"
          :style="{ height: `${(d.value / max) * 100}%`, animationDelay: `${i * 40}ms` }"
        >
          <span
            class="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-1.5 py-0.5 text-[10px] text-popover-foreground opacity-0 shadow-sm transition-opacity group-hover:opacity-100"
          >
            {{ format(d.value) }}
          </span>
        </div>
      </div>
    </div>
    <div class="mt-2 flex gap-2">
      <span
        v-for="d in data"
        :key="d.label"
        class="flex-1 truncate text-center text-xs text-muted-foreground"
      >
        {{ d.label }}
      </span>
    </div>
  </div>
</template>

<style scoped>
@keyframes bar-in {
  from {
    height: 0;
  }
}
.bar {
  animation: bar-in 500ms ease-out backwards;
}
</style>
