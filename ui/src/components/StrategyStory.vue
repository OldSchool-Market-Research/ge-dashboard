<script setup lang="ts">
// One strategy's story at the top of its page, in the order a person asks: what
// is its status and what does that mean, why did it close (or how is its test
// going), did it make money, and how.
import { computed } from 'vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { gp, timeAgo, type Outcome } from '@/lib/api'
import {
  hoursText,
  LANE_INFO,
  MONEY_CLASS,
  moneyOf,
  paperNote,
  STATE_INFO,
  TEST_CALL_CLASS,
  testProgress,
  whyClosed,
} from '@/lib/status'

const props = defineProps<{
  o: Outcome
  planLine: string | null // "501k per conversion x 3 per 4h batch"
  lastCheck: string | null // the newest check against its kill bar
}>()

const running = computed(() => !props.o.closed_at)
const info = computed(() => STATE_INFO[props.o.state])
const why = computed(() => whyClosed(props.o))
const money = computed(() => moneyOf(props.o))
const test = computed(() => testProgress(props.o))
const lane = computed(() => LANE_INFO[props.o.archetype])
const note = computed(() => paperNote(props.o))
const when = computed(() => {
  const o = props.o
  if (o.state === 'vetoed') return `Refused ${timeAgo(o.closed_at)}.`
  if (running.value) return `Shipped ${timeAgo(o.opened_at)}.`
  return `Closed ${timeAgo(o.closed_at)}, after ${hoursText(o.hours)}.`
})
const answer = computed(() => {
  switch (money.value.kind) {
    case 'made':
      return running.value ? 'Yes so far, on paper' : 'Yes, on paper'
    case 'lost':
      return running.value ? 'Down so far, on paper' : 'No, a paper loss'
    case 'flat':
      return 'No, it earned nothing'
    case 'play':
      return 'Only while someone plays it'
    case 'never':
      return 'No, it never traded'
    default:
      return 'Unknown'
  }
})
const vsPlan = computed(() => {
  const o = props.o
  if (o.est_realized_gp === null || !o.projected_gp || o.projected_gp <= 0) return null
  return `${Math.round((o.est_realized_gp / o.projected_gp) * 100)}% of the ${gp(o.projected_gp)} its plan implied for that time`
})
</script>

<template>
  <section class="grid gap-px overflow-hidden rounded-md border bg-border md:grid-cols-3">
    <div class="space-y-2 bg-card p-4">
      <h2 class="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Status</h2>
      <StatusBadge :state="o.state" />
      <p class="text-sm text-muted-foreground">{{ info?.meaning }}</p>
      <p class="text-xs text-muted-foreground">{{ when }}</p>
    </div>

    <div class="space-y-2 bg-card p-4">
      <h2 class="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">{{ running ? 'Its test so far' : 'Why' }}</h2>
      <template v-if="why">
        <p class="text-sm font-medium">{{ why.headline }}</p>
        <p class="text-sm text-muted-foreground">{{ why.detail }}</p>
      </template>
      <template v-else>
        <p class="text-sm font-medium" :class="TEST_CALL_CLASS[test.call]">{{ test.call }}</p>
        <div v-if="test.call !== 'waiting'" class="flex items-center gap-2">
          <div class="h-1.5 flex-1 bg-muted" role="img" :aria-label="`${Math.round(test.pct)}% of its test window gone`">
            <div class="h-full bg-chart-3" :style="{ width: `${test.pct}%` }" />
          </div>
          <span class="font-mono text-[11px] text-muted-foreground tabular-nums">{{ hoursText(o.hours) }} of {{ hoursText(o.window_hours) }}</span>
        </div>
        <p class="text-sm text-muted-foreground">{{ test.line }}</p>
        <p v-if="test.killLine" class="text-sm font-medium text-destructive">{{ test.killLine }}</p>
        <p class="text-xs text-muted-foreground">It closes early on {{ o.kill_needed }} kill signals in a row. If it reaches the end of the window it is judged against the bars above.</p>
      </template>
      <p v-if="lastCheck" class="text-xs text-muted-foreground">{{ lastCheck }}</p>
    </div>

    <div class="space-y-2 bg-card p-4">
      <h2 class="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">Did it make money?</h2>
      <p class="text-sm font-medium">{{ answer }}</p>
      <p class="font-mono text-2xl font-medium tabular-nums tracking-tight" :class="MONEY_CLASS[money.kind]">{{ money.value }}</p>
      <p class="font-mono text-xs text-muted-foreground">{{ money.how }}</p>
      <p v-if="vsPlan" class="text-xs text-muted-foreground">{{ vsPlan }}</p>
    </div>

    <div class="space-y-1.5 bg-card p-4 md:col-span-3">
      <h2 class="font-mono text-[11px] tracking-widest text-muted-foreground uppercase">How it makes money</h2>
      <p v-if="lane" class="text-sm"><strong class="font-medium">{{ lane.name }}.</strong> {{ lane.how }}</p>
      <p v-if="planLine" class="font-mono text-xs text-muted-foreground">{{ planLine }}</p>
      <p v-if="note" class="text-xs text-muted-foreground">{{ note }}</p>
    </div>
  </section>
</template>
