<script setup lang="ts">
// One strategy in a line: status, why it closed in words (or how its test is
// going while it runs), and the paper result with how that figure was reached.
// Click through for the full story.
import { computed } from 'vue'
import ItemIcon from '@/components/ItemIcon.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { gp, timeAgo, type Outcome } from '@/lib/api'
import { hoursText, laneName, MONEY_CLASS, moneyOf, TEST_CALL_CLASS, testProgress, whyClosed } from '@/lib/status'

const props = defineProps<{ o: Outcome }>()

const running = computed(() => !props.o.closed_at)
const name = computed(() => props.o.primary_item_name ?? props.o.title)
const why = computed(() => whyClosed(props.o))
const money = computed(() => moneyOf(props.o))
const test = computed(() => testProgress(props.o))
const life = computed(() => {
  const o = props.o
  if (o.state === 'vetoed') return `refused ${timeAgo(o.closed_at)}`
  if (running.value) return `shipped ${timeAgo(o.opened_at)}`
  return `lived ${hoursText(o.hours)}, closed ${timeAgo(o.closed_at)}`
})
</script>

<template>
  <RouterLink :to="`/book/${o.strategy_id}`" class="flex flex-wrap items-start gap-x-4 gap-y-2 border-b py-3 last:border-b-0 hover:bg-muted/30">
    <span class="flex size-10 shrink-0 items-center justify-center border bg-muted/40"><ItemIcon :icon="o.icon" :name="name" /></span>
    <div class="min-w-0 flex-[1_1_18rem] space-y-1">
      <div class="flex flex-wrap items-center gap-2">
        <span class="text-sm font-medium">{{ name }}</span>
        <StatusBadge :state="running ? (o.last_verdict ?? o.state) : o.state" />
        <span v-if="running" class="text-xs font-medium" :class="TEST_CALL_CLASS[test.call]">{{ test.call }}</span>
      </div>
      <p class="font-mono text-[11px] text-muted-foreground">{{ o.archetype }} #{{ o.strategy_id }} · {{ laneName(o.archetype) }} · {{ life }} · {{ o.run_mode }} run</p>
      <p v-if="why" class="text-xs text-muted-foreground"><strong class="font-medium text-foreground">{{ why.headline }}.</strong> {{ why.detail }}</p>
      <div v-if="running" class="space-y-1">
        <div v-if="test.call !== 'waiting'" class="flex items-center gap-2">
          <div class="h-1.5 w-32 bg-muted" role="img" :aria-label="`${Math.round(test.pct)}% of its test window gone`">
            <div class="h-full bg-chart-3" :style="{ width: `${test.pct}%` }" />
          </div>
          <span class="font-mono text-[11px] text-muted-foreground tabular-nums">{{ hoursText(o.hours) }} of {{ hoursText(o.window_hours) }} test</span>
        </div>
        <p class="text-xs text-muted-foreground">{{ test.line }}</p>
        <p v-if="test.killLine" class="text-xs font-medium text-destructive">{{ test.killLine }}</p>
      </div>
    </div>
    <div class="ml-auto max-w-[15rem] shrink-0 text-right">
      <div class="font-mono text-sm font-medium tabular-nums" :class="MONEY_CLASS[money.kind]">{{ money.value }}</div>
      <div class="font-mono text-[11px] text-muted-foreground">{{ money.how }}</div>
      <div v-if="o.projected_gp !== null" class="font-mono text-[11px] text-muted-foreground">plan {{ gp(o.projected_gp) }}</div>
    </div>
  </RouterLink>
</template>
