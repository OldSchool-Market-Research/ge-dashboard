<script setup lang="ts">
// One strategy in full: its legs as icons, the money, the live margin
// against the margin it shipped with (kill signals marked), the estimated
// realized pace against the projection, the verdict at every eval, its
// checks in words with the stale legs named, and the plan it shipped with.
// Works for closed strategies too; live ones refresh every minute.
import { Badge } from '@fisherrjd/ui/badge'
import { Card, CardContent } from '@fisherrjd/ui/card'
import { PageHeader } from '@fisherrjd/ui/layout'
import { ErrorState } from '@fisherrjd/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fisherrjd/ui/table'
import { ArrowLeftIcon, CheckIcon, XIcon } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import ItemIcon from '@/components/ItemIcon.vue'
import LegFlow from '@/components/LegFlow.vue'
import LineChart from '@/components/LineChart.vue'
import RealizedBars from '@/components/RealizedBars.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import VerdictStrip from '@/components/VerdictStrip.vue'
import { api, errorText, gp, type Evaluation, type Strategy } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import {
  ageText,
  cadence,
  checkLines,
  evalMargin,
  isCombo,
  legsOf,
  planMargin,
  projectedPerHour,
  shortName,
  unitLabel,
} from '@/lib/strategy'

// the API returns at most this many evaluations, newest first
const EVAL_LIMIT = 600

const route = useRoute()
const strategy = ref<Strategy | null>(null)
const evals = ref<Evaluation[]>([]) // oldest first
const icons = ref<Record<string, string>>({})
const error = ref<string | null>(null)

const s = computed(() => strategy.value)
const combo = computed(() => (s.value ? isCombo(s.value) : false))
const unit = computed(() => (s.value ? unitLabel(s.value) : ''))
const latest = computed(() => evals.value.at(-1) ?? null)
const legs = computed(() => (s.value ? legsOf(s.value, icons.value, latest.value) : []))
const plan = computed(() => (s.value ? planMargin(s.value, latest.value) : 0))
const live = computed(() => evalMargin(latest.value, combo.value))
const projected = computed(() => (s.value ? projectedPerHour(s.value) : null))
const units = computed(() => s.value?.units_used ?? null)
const evalCount = computed(() => (evals.value.length >= EVAL_LIMIT ? `last ${evals.value.length}` : String(evals.value.length)))

const marginPoints = computed(() => evals.value.map((e) => ({ t: Date.parse(e.at), v: evalMargin(e, combo.value) })))
const kills = computed(() =>
  evals.value
    .filter((e) => e.verdict === 'kill_signal' && evalMargin(e, combo.value) !== null)
    .map((e) => ({ t: Date.parse(e.at), v: evalMargin(e, combo.value)!, label: `kill signal ${new Date(e.at).toLocaleString()}` })),
)
const marginStats = computed(() => {
  const vals = marginPoints.value.map((p) => p.v).filter((v): v is number => v !== null).sort((a, b) => a - b)
  if (!vals.length) return null
  const mid = Math.floor(vals.length / 2)
  const median = vals.length % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2
  return { median, pct: plan.value > 0 ? Math.round((median / plan.value) * 100) : null, negative: vals.filter((v) => v < 0).length, n: vals.length }
})

const realizedPoints = computed(() => evals.value.map((e) => ({ t: Date.parse(e.at), v: e.realized_per_1h_gp })))
const realizedStats = computed(() => {
  const vals = realizedPoints.value.map((p) => p.v).filter((v): v is number => v !== null)
  return { hits: vals.filter((v) => v > 0).length, n: realizedPoints.value.length, peak: vals.length ? Math.max(...vals) : null }
})

// latest checks, with the stale or thin leg named. A leg with no recorded
// trade time or volume is said to be unknown, never ranked as oldest/thinnest.
const checks = computed(() => {
  const legDetail = latest.value?.detail?.legs ?? []
  const unknownAge = legDetail.filter((l) => l.age_s == null).map((l) => l.name)
  const byAge = legDetail.filter((l) => l.age_s != null).sort((a, b) => b.age_s! - a.age_s!)
  const byVol = legDetail.filter((l) => l.vol_30m != null).sort((a, b) => a.vol_30m! - b.vol_30m!)
  return checkLines(latest.value?.checks).map((c) => {
    let detail = ''
    if (c.key.includes('fresh') && unknownAge.length) {
      detail = `No recorded trade for ${unknownAge.join(', ')}.`
    } else if (c.key.includes('fresh') && byAge.length) {
      detail = `Oldest leg: ${byAge[0].name}, last traded ${ageText(byAge[0].age_s)} ago.`
    } else if (c.key === 'vol_ok' && byVol.length) {
      detail = `Thinnest leg: ${byVol[0].name}, ${byVol[0].vol_30m} traded in 30 min.`
    } else if (c.key === 'margin_ok' && live.value !== null) {
      detail = `Live margin ${gp(live.value)} ${unit.value} against the plan's ${gp(plan.value)}, both after tax.`
    }
    return { ...c, detail }
  })
})

const legRows = computed(() => {
  const detail = new Map((latest.value?.detail?.legs ?? []).map((l) => [`${l.side}:${l.item_id}`, l]))
  return legs.value.map((l) => {
    const d = detail.get(`${l.side}:${l.item_id}`)
    // single-item strategies have no per-leg detail: the eval's own volume is the item's
    const vol = d ? (d.vol_30m ?? null) : s.value?.legs?.length ? null : (latest.value?.vol_30m ?? null)
    return { ...l, vol, batch: l.price !== null && units.value ? l.price * l.qty * units.value : null }
  })
})

async function fetchOne() {
  const res = await api.strategy(String(route.params.id))
  strategy.value = res.strategy
  evals.value = [...res.evaluations].reverse()
  icons.value = res.item_icons ?? res.strategy.item_icons ?? {}
}

const { updatedAt, refreshError, markUpdated } = useAutoRefresh(async () => {
  if (strategy.value && !strategy.value.closed_at) await fetchOne()
})

async function load() {
  error.value = null
  try {
    await fetchOne()
    markUpdated()
  } catch (e) {
    error.value = errorText(e, 'No such strategy.')
  }
}
onMounted(load)
watch(() => route.params.id, load)
</script>

<template>
  <div class="space-y-6">
    <RouterLink to="/book" class="inline-flex items-center gap-1 font-mono text-xs text-primary-text hover:underline">
      <ArrowLeftIcon class="size-3.5" /> Strategy board
    </RouterLink>

    <ErrorState v-if="error" title="Strategy unavailable" :description="error" />

    <template v-else-if="s">
      <div class="flex flex-wrap items-center justify-between gap-6">
        <div class="min-w-0 flex-[1_1_420px] space-y-2">
          <div class="flex flex-wrap items-center gap-2 text-xs">
            <Badge variant="outline" class="font-mono">{{ s.archetype }}</Badge>
            <span class="font-mono text-muted-foreground">
              #{{ s.strategy_id }} · opened {{ new Date(s.opened_at).toLocaleString() }} · {{ evalCount }} evals
            </span>
            <StatusBadge :state="s.closed_at ? s.state : (latest?.verdict ?? s.state)" />
            <Badge variant="outline">confidence: {{ s.confidence }}</Badge>
          </div>
          <PageHeader :title="shortName(s)" :description="s.title" />
          <p v-if="s.horizon" class="max-w-2xl text-sm text-muted-foreground">“{{ s.horizon }}”</p>
          <UpdatedAgo v-if="!s.closed_at" :updated-at="updatedAt" :error="refreshError" />
        </div>
        <Card>
          <CardContent class="p-5"><LegFlow :legs="legs" large /></CardContent>
        </Card>
      </div>

      <div class="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <StatTile label="Capital" :value="gp(s.capital_required)" :hint="units ? `${units.toLocaleString()} per batch` : undefined" />
        <StatTile label="Per cycle" :value="gp(s.per_cycle_gp)" hint="one 4h buy-limit batch" />
        <StatTile label="Projected" :value="`${gp(projected)}/hr`" hint="per the plan" />
        <StatTile label="Plan margin" :value="gp(plan)" :hint="`${unit}, after tax`" />
        <StatTile label="Live margin" :value="gp(live)" :signed="live" :hint="`${unit}, latest eval`" />
      </div>

      <section class="space-y-2 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">Live margin {{ unit }} against the plan, after tax</h2>
        <p v-if="marginStats" class="text-sm text-muted-foreground">
          Median live margin is <strong class="font-mono text-foreground">{{ gp(marginStats.median) }}</strong>
          <template v-if="marginStats.pct !== null">, {{ marginStats.pct }}% of the plan's {{ gp(plan) }}</template>.
          Below zero in {{ marginStats.negative }} of the {{ marginStats.n }} priced evals shown<template v-if="kills.length">; {{ kills.length }} kill signals marked</template>.
        </p>
        <LineChart
          :points="marginPoints"
          :refs="[{ v: plan, label: `plan ${gp(plan)}` }]"
          :markers="kills"
          :label="`Live margin over ${marginPoints.length} evals against a plan of ${gp(plan)}`"
        />
      </section>

      <section class="space-y-2 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">Estimated realized pace at each eval</h2>
        <p class="text-sm text-muted-foreground">
          What the market could absorb at that moment, after the haircut. Above zero in
          <strong class="font-mono text-foreground">{{ realizedStats.hits }}</strong> of the {{ realizedStats.n }} evals shown<template v-if="realizedStats.peak">; best {{ gp(realizedStats.peak) }}/hr</template><template v-if="projected"> against {{ gp(projected) }}/hr projected (dashed)</template>.
        </p>
        <RealizedBars
          :points="realizedPoints"
          :projected="projected"
          :label="`Estimated realized gp per hour at each of ${realizedStats.n} evals`"
        />
        <div class="flex items-center gap-2">
          <span class="w-12 shrink-0 text-right font-mono text-[10px] text-muted-foreground">verdict</span>
          <VerdictStrip :verdicts="evals.map((e) => e.verdict)" />
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="space-y-3 rounded-md border bg-card p-4">
          <h2 class="text-sm font-medium">Latest checks, in plain English</h2>
          <ul class="space-y-2">
            <li v-for="c in checks" :key="c.key" class="flex gap-3 border bg-muted/30 p-3">
              <span
                class="flex size-6 shrink-0 items-center justify-center border"
                :class="c.ok ? 'border-success/40 text-success' : 'border-destructive/50 text-destructive'"
              >
                <CheckIcon v-if="c.ok" class="size-3.5" aria-hidden="true" />
                <XIcon v-else class="size-3.5" aria-hidden="true" />
              </span>
              <div>
                <div class="text-sm font-medium">{{ c.text }}</div>
                <div v-if="c.detail" class="text-xs text-muted-foreground">{{ c.detail }}</div>
              </div>
            </li>
          </ul>
          <p v-if="s.attention_spec" class="text-xs text-muted-foreground">
            Check {{ cadence(s.attention_spec.checks_per_hour) }} · can sit {{ s.attention_spec.max_unattended_hours }}h unattended<template v-if="s.kill_price"> · kill at {{ gp(s.kill_price) }}</template>
          </p>
        </section>

        <section class="min-w-0 space-y-3 rounded-md border bg-card p-4">
          <h2 class="text-sm font-medium">Legs</h2>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead class="text-right">Plan</TableHead>
                  <TableHead class="text-right">Price now</TableHead>
                  <TableHead class="text-right">Last trade</TableHead>
                  <TableHead class="text-right">Vol 30m</TableHead>
                  <TableHead class="text-right">Per batch</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="l in legRows" :key="`${l.side}:${l.item_id}`">
                  <TableCell>
                    <RouterLink :to="`/items/${l.item_id}`" class="inline-flex items-center gap-2 hover:underline">
                      <ItemIcon :icon="l.icon" /> <span>{{ l.qty !== 1 ? `${l.qty} × ` : '' }}{{ l.name }}</span>
                    </RouterLink>
                  </TableCell>
                  <TableCell class="font-mono text-xs text-muted-foreground">{{ l.side }}</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground tabular-nums">{{ gp(l.plan) }}</TableCell>
                  <TableCell class="text-right font-mono tabular-nums">{{ gp(l.price) }}</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground tabular-nums">{{ l.age_s === null ? '—' : `${ageText(l.age_s)} ago` }}</TableCell>
                  <TableCell class="text-right font-mono text-muted-foreground tabular-nums">{{ l.vol ?? '—' }}</TableCell>
                  <TableCell class="text-right font-mono tabular-nums">{{ gp(l.batch) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      </div>

      <section class="space-y-3 rounded-md border bg-card p-4 text-sm">
        <h2 class="text-sm font-medium">The plan it shipped with</h2>
        <p v-if="s.thesis" class="text-muted-foreground"><span class="font-medium text-foreground">Thesis.</span> {{ s.thesis }}</p>
        <p v-if="s.entry" class="text-muted-foreground"><span class="font-medium text-foreground">Entry.</span> {{ s.entry }}</p>
        <p v-if="s.exit" class="text-muted-foreground"><span class="font-medium text-foreground">Exit.</span> {{ s.exit }}</p>
        <p v-if="s.attention" class="text-muted-foreground"><span class="font-medium text-foreground">Attention.</span> {{ s.attention }}</p>
        <p v-if="s.state_reason" class="text-muted-foreground"><span class="font-medium text-foreground">State.</span> {{ s.state }}: {{ s.state_reason }}</p>
      </section>
    </template>
  </div>
</template>
