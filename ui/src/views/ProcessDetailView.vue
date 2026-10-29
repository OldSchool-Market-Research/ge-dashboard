<script setup lang="ts">
// One processing recipe: its live quote, the legs that make it up (where
// the cost, the cap and the stale prices are), the curation notes, and its
// gp/hr history from the hourly snapshots.
import { Badge } from '@fisherrjd/ui/badge'
import { Button } from '@fisherrjd/ui/button'
import { Card, CardContent } from '@fisherrjd/ui/card'
import { PageHeader } from '@fisherrjd/ui/layout'
import { EmptyState, ErrorState } from '@fisherrjd/ui/states'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fisherrjd/ui/table'
import { ArrowLeftIcon, HistoryIcon } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ProcessHistoryChart from '@/components/ProcessHistoryChart.vue'
import StatTile from '@/components/StatTile.vue'
import { api, gp, type ProcessDetail, type ProcessHistoryPoint } from '@/lib/api'
import { bindingRate, throughputLabel } from '@/lib/process'

const route = useRoute()
const id = route.params.id as string

const detail = ref<ProcessDetail | null>(null)
const history = ref<ProcessHistoryPoint[]>([])
const error = ref<string | null>(null)
const days = ref<1 | 7 | 30>(7)

const q = computed(() => detail.value?.quote)
const buys = computed(() => detail.value?.legs.filter((l) => l.side === 'buy') ?? [])
const sells = computed(() => detail.value?.legs.filter((l) => l.side === 'sell') ?? [])

function age(s: number | null) {
  if (s === null) return '—'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 172800) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
function qty(n: number) {
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

async function loadHistory() {
  // 1h buckets up to a week; daily-ish detail beyond that keeps the chart readable
  history.value = await api.processHistory(id, days.value, days.value > 7 ? '6h' : '1h')
}

async function load() {
  error.value = null
  try {
    detail.value = await api.processDetail(id)
    await loadHistory()
  } catch (e) {
    error.value = String(e)
  }
}

watch(days, () => loadHistory().catch((e) => (error.value = String(e))))
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <Button variant="ghost" size="sm" as-child>
      <RouterLink to="/process"><ArrowLeftIcon class="size-4" /> Processing</RouterLink>
    </Button>

    <ErrorState v-if="error" title="Couldn't load this recipe" :description="error" @retry="load" />

    <template v-else-if="detail && q">
      <PageHeader :title="q.name" :description="`${q.category} · ${throughputLabel[q.throughput]}`" />

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="gp/hr (slow)" :value="gp(q.gp_hr)" :signed="q.gp_hr" :hint="bindingRate(q) ?? undefined" />
        <StatTile label="gp/hr (insta)" :value="gp(q.gp_hr_insta)" :signed="q.gp_hr_insta" :hint="bindingRate(q, 'insta') ?? undefined" />
        <StatTile
          label="Margin / action"
          :value="gp(q.margin_slow)"
          :hint="q.fee_gp ? `after ${gp(q.fee_gp)} fee; insta ${gp(q.margin_insta)}` : `insta ${gp(q.margin_insta)}`"
        />
        <StatTile
          label="Actions / hr"
          :value="q.effective_actions_per_hour === null ? '—' : q.effective_actions_per_hour.toLocaleString()"
          :hint="`player ${q.actions_per_hour ?? '—'} · limit ${q.limit_actions_per_hour ?? '—'} · market ${q.market_actions_per_hour ?? '—'}`"
        />
      </div>

      <Card v-if="detail.notes || detail.relation_name || q.unknown_limit_legs > 0">
        <CardContent class="space-y-1.5 pt-4 text-sm">
          <p v-if="detail.notes">{{ detail.notes }}</p>
          <p v-if="detail.relation_name" class="text-muted-foreground">
            Legs come from the curated conversion <span class="font-medium text-foreground">{{ detail.relation_name }}</span>
            ({{ detail.relation_direction }}).
          </p>
          <p v-if="q.unknown_limit_legs > 0" class="text-muted-foreground">
            {{ q.unknown_limit_legs }} input{{ q.unknown_limit_legs > 1 ? 's have' : ' has' }} no known GE buy limit, so the
            limit cap leaves {{ q.unknown_limit_legs > 1 ? 'them' : 'it' }} out and the rate may be optimistic.
          </p>
        </CardContent>
      </Card>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium">gp/hr history (slow)</h2>
          <!-- filters in one row above the chart -->
          <div class="flex gap-1">
            <Button v-for="d in [1, 7, 30] as const" :key="d" :variant="days === d ? 'secondary' : 'ghost'" size="sm" @click="days = d">
              {{ d }}d
            </Button>
          </div>
        </div>
        <ProcessHistoryChart v-if="history.some((p) => p.gp_hr !== null)" :points="history" />
        <EmptyState
          v-else
          :icon="HistoryIcon"
          title="No priced history yet"
          :description="q.throughput === 'unknown' ? 'This recipe has no rate, so it has no gp/hr; its margin is tracked.' : 'The ingester snapshots every recipe once an hour.'"
        />
      </section>

      <section v-for="[label, legs] in [['Inputs (bought)', buys], ['Outputs (sold)', sells]] as const" :key="label">
        <h2 class="mb-2 text-sm font-medium">{{ label }}</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Item</TableHead>
              <TableHead class="text-right">Qty / action</TableHead>
              <TableHead class="text-right">Slow price</TableHead>
              <TableHead class="text-right">Insta price</TableHead>
              <TableHead class="text-right">Buy limit</TableHead>
              <TableHead class="text-right">24h fill volume</TableHead>
              <TableHead class="text-right">Price age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="l in legs" :key="l.item_id">
              <TableCell>
                <span class="font-medium">{{ l.name ?? `item ${l.item_id}` }}</span>
                <span class="ml-1 font-mono text-xs text-muted-foreground">{{ l.item_id }}</span>
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ qty(l.qty) }}</TableCell>
              <TableCell class="text-right tabular-nums">
                {{ gp(l.price_slow) }}
                <Badge v-if="l.price_slow === null" variant="outline" class="ml-1 text-[10px]">nothing traded</Badge>
              </TableCell>
              <TableCell class="text-right tabular-nums text-muted-foreground">{{ gp(l.price_insta) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ l.side === 'buy' ? (l.buy_limit?.toLocaleString() ?? 'unknown') : '—' }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ l.fill_volume_24h === null ? '—' : l.fill_volume_24h.toLocaleString() }}</TableCell>
              <TableCell class="text-right font-mono text-xs text-muted-foreground">{{ age(l.slow_age_s) }}</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>

      <p class="font-mono text-xs text-muted-foreground">
        Source: sheet {{ detail.source }} · prices are the latest trade on each side · skill and quest requirements aren't checked
      </p>
    </template>
  </div>
</template>
