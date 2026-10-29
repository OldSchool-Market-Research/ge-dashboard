<script setup lang="ts">
// An OSRS item icon from the /mapping file name (items.icon), served by the
// dashboard's own /icons cache (icons.go), never the Wiki directly. Icons are
// small pixel art: kept at native size, crisp, and hidden if one fails to
// load rather than showing a broken-image box. Decorative: the item name is
// always next to it, so alt is empty.
import { ref, watch } from 'vue'

const props = defineProps<{ icon: string | null | undefined }>()
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
      alt=""
      loading="lazy"
      class="max-h-8 max-w-8 [image-rendering:pixelated]"
      @error="failed = true"
    />
  </span>
</template>
