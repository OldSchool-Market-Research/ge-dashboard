<script setup lang="ts">
// An OSRS item icon from the /mapping file name (items.icon), served by the
// dashboard's own /icons cache (icons.go), never the Wiki directly. Icons are
// small pixel art: kept at native size, crisp, and hidden if one fails to
// load rather than showing a broken-image box. Pass `name` where the icon
// stands alone (no item name printed next to it) so it isn't silent to a
// screen reader; with the name beside it, leave it out (alt stays empty).
import { ref, watch } from 'vue'

const props = defineProps<{ icon: string | null | undefined; name?: string }>()
const failed = ref(false)
// a new icon gets a fresh try (a one-off upstream 502 shouldn't stick)
watch(
  () => props.icon,
  () => (failed.value = false),
)
</script>

<template>
  <span class="inline-flex size-8 shrink-0 items-center justify-center">
    <img
      v-if="icon && !failed"
      :src="`/icons/${encodeURIComponent(icon)}`"
      :alt="name ?? ''"
      loading="lazy"
      class="max-h-8 max-w-8 [image-rendering:pixelated]"
      @error="failed = true"
    />
    <span v-else-if="name" class="sr-only">{{ name }}</span>
  </span>
</template>
