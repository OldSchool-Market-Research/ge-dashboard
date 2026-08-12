<script setup lang="ts">
import { GitPullRequestIcon } from '@lucide/vue'
import UserAvatar from '@/components/dashboard/UserAvatar.vue'
import StatusBadge from './StatusBadge.vue'

withDefaults(
  defineProps<{
    number: number
    title: string
    branch: string
    status?: 'open' | 'draft' | 'merged' | 'closed'
    /** CI state — rendered as a StatusBadge on the right */
    checks?: 'passing' | 'failing' | 'pending'
    assignees?: string[]
  }>(),
  { status: 'open', assignees: () => [] },
)

const iconColor = {
  open: 'text-emerald-500',
  draft: 'text-muted-foreground',
  merged: 'text-violet-500',
  closed: 'text-red-500',
}
</script>

<template>
  <div class="-mx-2 flex items-center gap-3 rounded-lg px-2 py-2.5 transition-colors hover:bg-muted/60">
    <GitPullRequestIcon class="size-4 shrink-0" :class="iconColor[status]" />
    <div class="min-w-0 flex-1">
      <p class="truncate text-sm font-medium">
        {{ title }}
        <span class="font-normal text-muted-foreground">#{{ number }}</span>
      </p>
      <code class="mt-0.5 block truncate font-mono text-xs text-muted-foreground">{{ branch }}</code>
    </div>
    <StatusBadge v-if="checks" :status="checks" class="max-sm:hidden" />
    <div v-if="assignees.length" class="flex -space-x-2">
      <UserAvatar
        v-for="a in assignees"
        :key="a"
        :name="a"
        size="sm"
        class="ring-2 ring-background"
      />
    </div>
  </div>
</template>
