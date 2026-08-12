<script setup lang="ts">
import UserAvatar from '@/components/dashboard/UserAvatar.vue'

defineProps<{
  author: string
  /** already formatted for display */
  date: string
  readingTime?: string
}>()
</script>

<template>
  <div class="flex items-center gap-2 text-sm text-muted-foreground">
    <UserAvatar :name="author" size="sm" />
    <span class="font-medium text-foreground">{{ author }}</span>
    <span aria-hidden="true">·</span>
    <span>{{ date }}</span>
    <template v-if="readingTime">
      <span aria-hidden="true">·</span>
      <span>{{ readingTime }}</span>
    </template>
  </div>
</template>
