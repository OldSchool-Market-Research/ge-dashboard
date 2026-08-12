<script setup lang="ts">
import { ref } from 'vue'
import { RouterLink } from 'vue-router'
import Checklist from '@/components/project/Checklist.vue'
import FreshnessDot from '@/components/project/FreshnessDot.vue'
import PullRequestItem from '@/components/project/PullRequestItem.vue'
import SaveIndicator from '@/components/project/SaveIndicator.vue'
import StatusBadge from '@/components/project/StatusBadge.vue'
import { Card } from '@/components/ui/card'

const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString()

const releaseSteps = [
  { id: 'typecheck', label: 'Typecheck passes' },
  { id: 'build', label: 'Production build is green' },
  { id: 'phone', label: 'Reviewed on the phone over tailscale' },
  { id: 'tag', label: 'Tag and push' },
]
const releaseDone = ref(['typecheck', 'build'])

const statuses = [
  'open',
  'draft',
  'merged',
  'closed',
  'passing',
  'pending',
  'failing',
  'todo',
  'in-progress',
  'review',
  'done',
  'blocked',
]
</script>

<template>
  <div class="space-y-8">
    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        StatusBadge — one pill for every lifecycle; unknown statuses fall back to neutral
      </h3>
      <Card class="flex-row flex-wrap gap-2 p-5">
        <StatusBadge v-for="s in statuses" :key="s" :status="s" />
      </Card>
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        PullRequestItem — status icon, branch, CI badge, assignees
      </h3>
      <Card class="gap-0 p-5">
        <PullRequestItem
          :number="42"
          title="Add GitHub webhook receiver"
          branch="feat/webhooks"
          status="open"
          checks="passing"
          :assignees="['Jade Fisher']"
        />
        <PullRequestItem
          :number="40"
          title="Fix theme flash on first paint"
          branch="fix/theme-flash"
          status="merged"
          checks="passing"
        />
        <PullRequestItem
          :number="39"
          title="Experiment: oklch tokens"
          branch="spike/oklch"
          status="draft"
          checks="failing"
          :assignees="['Maya Okafor', 'Liam Chen']"
        />
      </Card>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          FreshnessDot — reality signal from a last-activity date (from atlas)
        </h3>
        <Card class="gap-2 p-5 text-sm">
          <p class="flex items-center gap-2">
            <FreshnessDot :date="daysAgo(3)" verb="pushed" /> pushed 3 days ago — fresh
          </p>
          <p class="flex items-center gap-2">
            <FreshnessDot :date="daysAgo(45)" verb="pushed" /> pushed 45 days ago — cooling
          </p>
          <p class="flex items-center gap-2">
            <FreshnessDot :date="daysAgo(200)" verb="pushed" /> pushed 200 days ago — dormant
          </p>
        </Card>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          SaveIndicator — autosave status for debounced writes (from atlas)
        </h3>
        <Card class="flex-row items-center gap-6 p-5">
          <SaveIndicator state="saved" />
          <SaveIndicator state="saving" />
          <SaveIndicator state="error" />
        </Card>

        <h3 class="pt-3 text-sm font-medium text-muted-foreground">
          Checklist — v-model:done, strike-through + progress (from chore-tracker)
        </h3>
        <Card class="p-5">
          <Checklist v-model:done="releaseDone" :items="releaseSteps" />
        </Card>
      </div>
    </div>

    <p class="text-sm text-muted-foreground">
      The kanban board (touch drag & drop) and the notes panel are best seen live on the
      <RouterLink to="/project" class="font-medium text-foreground underline underline-offset-4">
        Project page
      </RouterLink>
      — both persist to localStorage.
    </p>
  </div>
</template>
