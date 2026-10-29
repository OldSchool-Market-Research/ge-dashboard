<script setup lang="ts">
// One processing recipe: its live quote, the legs that make it up (where
// the cost, the cap and the stale prices are), the curation notes, and its
// history from the hourly snapshots (gp/hr, or margin when it has no rate).
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
import ItemIcon from '@/components/ItemIcon.vue'
import ProcessHistoryChart from '@/components/ProcessHistoryChart.vue'
import StatTile from '@/components/StatTile.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import { api, errorText, gp, type ProcessDetail, type ProcessHistoryPoint, type ProcessQuote } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import { activeTime, bindingRate, perWindow, throughputLabel } from '@/lib/process'

const route = useRoute()
const id = route.params.id as string

const detail = ref<ProcessDetail | null>(null)
const history = ref<ProcessHistoryPoint[]>([])
const error = ref<string | null>(null)
const days = ref<1 | 7 | 30>(7)
// 1h buckets up to a week; 6h beyond keeps the chart readable (and under
// the API's 400-point cap)
const bucketHours = computed(() => (days.value > 7 ? 6 : 1))

const q = computed(() => detail.value?.quote)
const buys = computed(() => detail.value?.legs.filter((l) => l.side === 'buy') ?? [])
const sells = computed(() => detail.value?.legs.filter((l) => l.side === 'sell') ?? [])
// no rate means no gp/hr anywhere in history: chart the margin instead
const chartMetric = computed<'gp_hr' | 'margin_slow'>(() =>
  history.value.some((p) => p.gp_hr !== null) ? 'gp_hr' : 'margin_slow',
)
const hasHistory = computed(() => history.value.some((p) => p[chartMetric.value] !== null))

const rateSource = computed(() => {
  const r = q.value
  if (!r) return ''
  if (r.throughput === 'unknown') return 'rate unknown'
  if (r.throughput === 'volume_bound') return 'rate source: market volume and buy limits'
  return `rate source: ${throughputLabel[r.throughput]} (${r.actions_per_hour?.toLocaleString()}/hr), capped by limits and volume`
})

// why a gp/hr tile is empty, or which ceiling sets it
function gpHint(r: ProcessQuote, basis: 'slow' | 'insta') {
  const missing = basis === 'slow' ? r.missing_legs : r.missing_legs_insta
  if (missing > 0) return `${missing} leg${missing === 1 ? '' : 's'} unpriced`
  if (r.throughput === 'unknown') return 'no rate: judge it on margin'
  return bindingRate(r, basis) ?? undefined
}

function age(s: number | null) {
  if (s === null) return '—'
  if (s < 3600) return `${Math.round(s / 60)}m`
  if (s < 172800) return `${Math.round(s / 3600)}h`
  return `${Math.round(s / 86400)}d`
}
function qty(n: number | null) {
  if (n === null) return '—'
  return Number.isInteger(n) ? n.toLocaleString() : n.toLocaleString(undefined, { maximumFractionDigits: 4 })
}

// only the latest request may land: fast 1d -> 30d clicks can resolve out of order
let historySeq = 0
async function loadHistory() {
  const seq = ++historySeq
  const pts = await api.processHistory(id, days.value, bucketHours.value === 6 ? '6h' : '1h')
  if (seq === historySeq) history.value = pts
}

async function fetchAll() {
  detail.value = await api.processDetail(id)
  await loadHistory()
}
const { updatedAt, refreshError, markUpdated } = useAutoRefresh(fetchAll)

async function load() {
  error.value = null
  try {
    await fetchAll()
    markUpdated()
  } catch (e) {
    error.value = errorText(e, 'There is no processing recipe with this id.')
  }
}

watch(days, () => loadHistory().catch((e) => (error.value = errorText(e))))
onMounted(load)
</script>

<template>
  <div class="space-y-6">
    <Button variant="ghost" size="sm" as-child>
      <RouterLink to="/process"><ArrowLeftIcon class="size-4" /> Processing</RouterLink>
    </Button>

    <ErrorState
      v-if="error"
      title="Couldn't load this recipe"
      :description="error"
      @retry="load"
    />

    <template v-else-if="detail && q">
      <div class="flex items-center gap-3">
        <ItemIcon :icon="q.icon" />
        <PageHeader :title="q.name" :description="`${q.category} · ${rateSource}`" />
      </div>
      <UpdatedAgo :updated-at="updatedAt" :error="refreshError" />

      <div class="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatTile label="gp/hr (slow)" :value="gp(q.gp_hr)" :signed="q.gp_hr" :hint="gpHint(q, 'slow')" />
        <StatTile label="gp/hr (insta)" :value="gp(q.gp_hr_insta)" :signed="q.gp_hr_insta" :hint="gpHint(q, 'insta')" />
        <StatTile
          label="Per 4h window (slow)"
          :value="gp(perWindow(q.gp_hr))"
          :signed="perWindow(q.gp_hr)"
          :hint="q.gp_hr !== null && activeTime(q) ? `~${activeTime(q)} of clicking at player speed` : 'one GE buy-limit window'"
        />
        <StatTile
          label="Margin / action (slow)"
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
          <h2 class="text-sm font-medium">{{ chartMetric === 'gp_hr' ? 'gp/hr history (slow)' : 'Margin per action history (slow)' }}</h2>
          <!-- filters in one row above the chart -->
          <div class="flex gap-1" role="group" aria-label="History range">
            <Button
              v-for="d in [1, 7, 30] as const"
              :key="d"
              :variant="days === d ? 'secondary' : 'ghost'"
              size="sm"
              :aria-pressed="days === d"
              @click="days = d"
            >
              {{ d }}d
            </Button>
          </div>
        </div>
        <ProcessHistoryChart v-if="hasHistory" :points="history" :metric="chartMetric" :days="days" :bucket-hours="bucketHours" />
        <EmptyState v-else :icon="HistoryIcon" title="No priced history yet" description="The ingester snapshots every recipe once an hour." />
      </section>

      <section v-for="[label, rows] in [['Inputs (bought)', buys], ['Outputs (sold)', sells]] as const" :key="label">
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
              <TableHead class="text-right">Slow price age</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="(l, i) in rows" :key="l.item_id ?? `leg-${i}`">
              <TableCell>
                <div class="flex items-center gap-2">
                  <ItemIcon :icon="l.icon" />
                  <span class="font-medium">{{ l.name ?? (l.item_id === null ? 'malformed leg' : `item ${l.item_id}`) }}</span>
                  <span v-if="l.item_id !== null" class="font-mono text-xs text-muted-foreground">{{ l.item_id }}</span>
                </div>
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
