<script setup lang="ts">
// One open strategy on the board: lane and health, its legs as item icons,
// the live margin over the last evals, how all its evals split by verdict,
// the money, and its checks in words. Click through for the full detail.
import { Badge } from '@fisherrjd/ui/badge'
import { Card, CardContent } from '@fisherrjd/ui/card'
import { ArrowRightIcon } from '@lucide/vue'
import { computed } from 'vue'
import CheckChips from '@/components/CheckChips.vue'
import HealthStrip from '@/components/HealthStrip.vue'
import LegFlow from '@/components/LegFlow.vue'
import Sparkline from '@/components/Sparkline.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { gp, timeAgo, type Strategy } from '@/lib/api'
import {
  cadence,
  isCombo,
  latestEval,
  legsOf,
  marginNow as liveMargin,
  projectedPerHour,
  shortName,
  trailMargin,
  unitLabel,
} from '@/lib/strategy'

const props = defineProps<{ strategy: Strategy }>()

const s = computed(() => props.strategy)
const ev = computed(() => latestEval(s.value))
const legs = computed(() => legsOf(s.value))
const margins = computed(() => (s.value.trail ?? []).map((p) => trailMargin(p, isCombo(s.value))))
const marginNow = computed(() => liveMargin(s.value))
const verdict = computed(() => s.value.live_verdict ?? ev.value?.verdict ?? s.value.state)
const checks = computed(() => s.value.live_checks ?? ev.value?.checks)
</script>

<template>
  <Card class="flex flex-col">
    <CardContent class="flex flex-1 flex-col gap-3 p-4">
      <div class="flex flex-wrap items-center gap-2 text-xs">
        <Badge variant="outline" class="font-mono">{{ s.archetype }}</Badge>
        <span class="font-mono text-muted-foreground">#{{ s.strategy_id }}</span>
        <StatusBadge :state="verdict" />
        <span class="ml-auto text-muted-foreground">opened {{ timeAgo(s.opened_at) }}</span>
      </div>

      <div>
        <h3 class="text-base leading-tight font-semibold">{{ shortName(s) }}</h3>
        <p class="mt-0.5 line-clamp-2 text-xs text-muted-foreground" :title="s.title">{{ s.title }}</p>
      </div>

      <LegFlow :legs="legs" />
      <p class="font-mono text-xs text-muted-foreground tabular-nums">
        {{ unitLabel(s) }}: buy {{ gp(s.entry_price) }} → sell {{ gp(s.exit_price) }}{{ isCombo(s) ? ' after tax' : '' }}
      </p>

      <figure class="space-y-1">
        <figcaption class="flex justify-between text-xs text-muted-foreground">
          <span>Live margin {{ unitLabel(s) }}, last {{ margins.length }} evals</span>
          <span class="font-mono text-foreground tabular-nums">now {{ gp(marginNow) }}</span>
        </figcaption>
        <Sparkline :values="margins" :label="`Live margin for ${shortName(s)}, now ${gp(marginNow)}`" />
      </figure>

      <HealthStrip v-if="s.verdict_counts" :counts="s.verdict_counts" />

      <dl class="grid grid-cols-3 gap-2">
        <div>
          <dt class="text-[11px] tracking-wider text-muted-foreground uppercase">Capital</dt>
          <dd class="font-mono text-sm tabular-nums">{{ gp(s.capital_required) }}</dd>
        </div>
        <div>
          <dt class="text-[11px] tracking-wider text-muted-foreground uppercase">Projected</dt>
          <dd class="font-mono text-sm tabular-nums">{{ gp(projectedPerHour(s)) }}/hr</dd>
        </div>
        <div>
          <dt class="text-[11px] tracking-wider text-muted-foreground uppercase">Check</dt>
          <dd class="font-mono text-sm">{{ cadence(s.attention_spec?.checks_per_hour) }}</dd>
        </div>
      </dl>

      <CheckChips :checks="checks" />

      <RouterLink
        :to="`/book/${s.strategy_id}`"
        class="mt-auto inline-flex items-center gap-1 border-t pt-3 font-mono text-sm text-primary-text hover:underline"
      >
        Open detail <ArrowRightIcon class="size-4" />
      </RouterLink>
    </CardContent>
  </Card>
</template>
