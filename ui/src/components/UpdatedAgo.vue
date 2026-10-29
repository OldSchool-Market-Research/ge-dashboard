<script setup lang="ts">
// "updated 12s ago · refreshes every minute", or a quiet warning when the
// last auto-refresh failed (the page keeps showing the previous data).
import { onMounted, onUnmounted, ref } from 'vue'

defineProps<{ updatedAt: number | null; error: string | null }>()

const now = ref(Date.now())
let timer: number | undefined
onMounted(() => (timer = window.setInterval(() => (now.value = Date.now()), 5000)))
onUnmounted(() => window.clearInterval(timer))

function ago(t: number) {
  const s = Math.max(0, Math.round((now.value - t) / 1000))
  return s < 60 ? `${s}s ago` : `${Math.round(s / 60)}m ago`
}
</script>

<template>
  <span class="font-mono text-xs text-muted-foreground" aria-live="polite">
    <template v-if="error">
      <span class="text-warning">refresh failed</span> · showing data from {{ updatedAt ? ago(updatedAt) : 'earlier' }}
    </template>
    <template v-else-if="updatedAt">updated {{ ago(updatedAt) }} · refreshes every minute</template>
  </span>
</template>
