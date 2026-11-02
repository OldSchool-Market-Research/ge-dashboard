<script setup lang="ts">
// The shared time window (lib/window.ts): pick it once, every page follows.
import { Button } from '@fisherrjd/ui/button'
import { useTimeWindow, WINDOWS } from '@/lib/window'

const { win, set } = useTimeWindow()
</script>

<template>
  <div class="flex gap-1" role="group" aria-label="Time window">
    <Button
      v-for="w in WINDOWS"
      :key="w.key"
      :variant="win.key === w.key ? 'secondary' : 'ghost'"
      size="sm"
      :aria-pressed="win.key === w.key"
      @click="set(w.key)"
    >
      {{ w.label }}
    </Button>
  </div>
</template>
