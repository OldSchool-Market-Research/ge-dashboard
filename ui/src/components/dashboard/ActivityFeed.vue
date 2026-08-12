<script setup lang="ts">
import type { Component } from 'vue'

defineProps<{
  items: {
    id: string | number
    title: string
    description?: string
    time: string
    icon?: Component
  }[]
}>()
</script>

<template>
  <ol>
    <li
      v-for="(item, i) in items"
      :key="item.id"
      class="relative flex gap-3 pb-5 last:pb-0"
    >
      <span
        v-if="i < items.length - 1"
        class="absolute top-8 left-4 h-[calc(100%-2rem)] w-px bg-border"
        aria-hidden="true"
      />
      <span
        class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary"
      >
        <component :is="item.icon" v-if="item.icon" class="size-4" />
        <span v-else class="size-2 rounded-full bg-primary" />
      </span>
      <div class="min-w-0 flex-1 pt-1">
        <div class="flex items-baseline justify-between gap-2">
          <p class="truncate text-sm font-medium">{{ item.title }}</p>
          <p class="shrink-0 text-xs text-muted-foreground">{{ item.time }}</p>
        </div>
        <p v-if="item.description" class="mt-0.5 text-xs text-muted-foreground">
          {{ item.description }}
        </p>
      </div>
    </li>
  </ol>
</template>
