<script setup lang="ts">
// Performance: is the money real? Paper gp earned in the window (each
// strategy's result spread over the hours it traded, running ones included),
// every closed strategy's projection against what it realized, how strategies
// ended, each lane's realized share of its projection, and the best and
// worst with their item icons. Paper estimates with the evaluator's
// haircut: an upper bound, not a ledger.
import { Badge } from '@fisherrjd/ui/badge'
import { Button } from '@fisherrjd/ui/button'
import { PageHeader } from '@fisherrjd/ui/layout'
import { ErrorState } from '@fisherrjd/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fisherrjd/ui/table'
import { useTheme } from '@fisherrjd/ui/theme'
import { computed, onMounted, ref } from 'vue'
import DailyPnlChart from '@/components/DailyPnlChart.vue'
import ItemIcon from '@/components/ItemIcon.vue'
import LineChart from '@/components/LineChart.vue'
import ScatterChart from '@/components/ScatterChart.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import WindowPicker from '@/components/WindowPicker.vue'
import { api, gp, type CalibrationResponse, type PnLResponse, type PnLRow } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import { archetypeColor } from '@/lib/viz'
import { accrualBuckets, earnedIn, firstStart, FOLLOW_ALL_NOTE, measureNotes, useTimeWindow } from '@/lib/window'

const { mode } = useTheme()
const { win } = useTimeWindow()
const pnl = ref<PnLResponse | null>(null)
const cal = ref<CalibrationResponse | null>(null)
const error = ref<string | null>(null)
const showAll = ref(false)
const lane = ref<string>('all')

const total = computed(() => Object.values(pnl.value?.by_state ?? {}).reduce((s, b) => s + b.est_realized_gp, 0))
const projectedTotal = computed(() => Object.values(pnl.value?.by_state ?? {}).reduce((s, b) => s + b.projected_gp, 0))
const lanes = computed(() => Object.keys(pnl.value?.by_archetype ?? {}).sort())

const strategies = computed(() => pnl.value?.strategies ?? [])
const asOf = computed(() => (pnl.value ? Date.parse(pnl.value.as_of) : Date.now()))
const cutoff = computed(() =>
  win.value.hours === null ? firstStart(strategies.value, asOf.value) : asOf.value - win.value.hours * 3600_000,
)
const closedInWindow = computed(() =>
  strategies.value.filter((r) => r.closed_at && r.est_realized_gp !== null && new Date(r.closed_at).getTime() >= cutoff.value),
)

const buckets = computed(() => accrualBuckets(strategies.value, asOf.value, cutoff.value, win.value.bucketHours))
function bucketLabel(t: number): string {
  const d = new Date(t)
  const day = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const clock = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false })
  if (win.value.bucketHours >= 24) return day
  return win.value.hours === 24 ? clock : `${day} ${clock}`
}
const days = computed(() =>
  buckets.value.map((b) => ({
    day: win.value.bucketHours >= 24 ? new Date(b.t).toISOString().slice(0, 10) : new Date(b.t).toLocaleString(),
    label: bucketLabel(b.t),
    gp: b.gp,
    n: b.alive,
    note: `${b.alive} strategies trading`,
  })),
)
const cumulative = computed(() => {
  let run = 0
  return buckets.value.map((b) => ({ t: b.t, v: (run += b.gp) }))
})
const earned = computed(() => buckets.value.reduce((s, b) => s + b.gp, 0))
const earnedBefore = computed(() =>
  win.value.hours === null ? null : earnedIn(strategies.value, asOf.value, cutoff.value - win.value.hours * 3600_000, cutoff.value),
)
// the comparison window counts too: its figure sits right beside this one
const notes = computed(() => measureNotes(win.value.hours === null ? cutoff.value : cutoff.value - win.value.hours * 3600_000, asOf.value))
const bucketName = computed(() => (win.value.bucketHours >= 24 ? 'day' : win.value.bucketHours === 1 ? 'hour' : `${win.value.bucketHours} hours`))

const scatter = computed(() =>
  closedInWindow.value
    .filter((r) => r.projected_gp !== null && r.projected_gp > 0)
    .filter((r) => lane.value === 'all' || r.archetype === lane.value)
    .map((r) => ({ id: r.strategy_id, archetype: r.archetype, title: r.primary_item_name ?? r.title, projected: r.projected_gp!, realized: r.est_realized_gp! })),
)
const scatterStats = computed(() => ({
  beat: scatter.value.filter((p) => p.realized > 0 && p.realized >= p.projected).length,
  zero: scatter.value.filter((p) => p.realized <= 0).length,
}))

const outcomes = computed(() => {
  const rows = Object.entries(pnl.value?.by_state ?? {}).map(([state, b]) => ({ state, ...b }))
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.est_realized_gp)))
  const order = ['killed', 'expired', 'confirmed', 'open', 'armed']
  return rows
    .sort((a, b) => order.indexOf(a.state) - order.indexOf(b.state))
    .map((r) => ({ ...r, pct: (Math.abs(r.est_realized_gp) / max) * 100 }))
})
const laneBars = computed(() =>
  Object.entries(pnl.value?.by_archetype ?? {})
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([a, b]) => ({
      archetype: a,
      ...b,
      pct: b.projected_gp > 0 ? Math.max(0, Math.min(100, (b.est_realized_gp / b.projected_gp) * 100)) : 0,
      color: archetypeColor(a, mode.value === 'dark'),
    })),
)
// Lanes only: the per-recipe rows (C:set, ...) live on the Calibration page.
const calLatest = computed(() => (cal.value?.latest ?? []).filter((c) => !c.archetype.includes(':')))

const ranked = computed(() => [...closedInWindow.value].sort((a, b) => b.est_realized_gp! - a.est_realized_gp!))
const best = computed(() => ranked.value.slice(0, 5))
const worst = computed(() => ranked.value.slice(-5).reverse().filter((r) => !best.value.includes(r)))

const rows = computed(() => {
  const all = [...(pnl.value?.strategies ?? [])].sort(
    (a, b) => Math.abs(b.est_realized_gp ?? 0) - Math.abs(a.est_realized_gp ?? 0),
  )
  return showAll.value ? all : all.slice(0, 25)
})

function rowName(r: PnLRow) {
  return r.primary_item_name ?? r.title
}

async function fetchAll() {
  ;[pnl.value, cal.value] = await Promise.all([api.pnl(), api.calibration(30).catch(() => null)])
}
const { updatedAt, refreshError, markUpdated } = useAutoRefresh(fetchAll)

onMounted(async () => {
  try {
    await fetchAll()
    markUpdated()
  } catch (e) {
    error.value = String(e)
  }
})
</script>

<template>
  <ErrorState v-if="error" title="P&L unavailable" :description="error" />
  <div v-else-if="pnl" class="space-y-6">
    <PageHeader title="Performance" description="Is the money real? Paper estimates with the self-impact haircut: an upper bound, not a ledger.">
      <template #actions>
        <UpdatedAgo :updated-at="updatedAt" :error="refreshError" />
        <WindowPicker />
      </template>
    </PageHeader>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile
        :label="`Paper earned, ${win.label}`"
        :value="`${earned > 0 ? '+' : ''}${gp(earned)}`"
        :signed="earned"
        :hint="earnedBefore !== null ? `${win.before}: ${gp(earnedBefore)}` : 'since the first strategy'"
      />
      <StatTile
        label="Realized, all time"
        :value="gp(total)"
        :signed="total"
        :hint="lanes.map((a) => `${a} ${gp(pnl!.by_archetype[a].est_realized_gp)}`).join(' · ') + (pnl.quarantined?.n ? ` · ${pnl.quarantined.n} quarantined left out` : '')"
      />
      <StatTile
        label="Projected, all time"
        :value="gp(projectedTotal)"
        :hint="projectedTotal > 0 ? `realized is ${Math.round((total / projectedTotal) * 100)}% of it` : undefined"
      />
      <StatTile
        label="Calibration"
        :value="calLatest.map((c) => `${c.archetype} ${c.factor.toFixed(2)}`).join(' · ') || '—'"
        hint="realized per projected gp, by lane"
      />
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="space-y-2 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">Paper gp added up, {{ win.long }}</h2>
        <LineChart
          v-if="cumulative.length"
          :points="cumulative"
          :width="560"
          :height="260"
          :days="win.bucketHours >= 24"
          :label="`Paper gp added up over the ${win.long}: ${gp(cumulative.at(-1)?.v ?? 0)}`"
        />
        <p v-else class="text-sm text-muted-foreground">Nothing traded in this window.</p>
      </section>
      <section class="space-y-2 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">Paper gp per {{ bucketName }}</h2>
        <DailyPnlChart :days="days" :width="560" />
      </section>
    </div>
    <p class="text-xs text-muted-foreground">
      Each strategy's result is spread evenly over the hours it traded, so a 48h strategy closing today doesn't land all at once, and running ones count for what they have done so far. Their figures can still move as more checks come in. {{ FOLLOW_ALL_NOTE }} <template v-for="n in notes" :key="n">{{ n }} </template>
    </p>

    <section class="space-y-3 rounded-md border bg-card p-4">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-sm font-medium">Every closed strategy: projected against realized</h2>
        <div class="flex gap-1" role="group" aria-label="Lane">
          <Button :variant="lane === 'all' ? 'secondary' : 'ghost'" size="sm" :aria-pressed="lane === 'all'" @click="lane = 'all'">All lanes</Button>
          <Button v-for="a in lanes" :key="a" :variant="lane === a ? 'secondary' : 'ghost'" size="sm" :aria-pressed="lane === a" @click="lane = a">{{ a }}</Button>
        </div>
      </div>
      <p class="text-sm text-muted-foreground">
        Dots on the dashed line earned what they promised.
        <strong class="font-mono text-foreground">{{ scatterStats.beat }}</strong> of {{ scatter.length }} beat their projection;
        <strong class="font-mono text-foreground">{{ scatterStats.zero }}</strong> realized nothing or lost (bottom strip).
      </p>
      <ScatterChart :points="scatter" />
      <div class="flex flex-wrap gap-4 text-xs text-muted-foreground">
        <span v-for="a in lanes" :key="a" class="inline-flex items-center gap-1.5">
          <span class="size-2.5" :class="a === 'C' ? 'rounded-full' : a === 'F' ? '' : 'rotate-45'" :style="{ background: archetypeColor(a, mode === 'dark') }" />
          {{ a }} lane
        </span>
      </div>
    </section>

    <div class="grid gap-4 lg:grid-cols-2">
      <section class="space-y-3 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">How strategies ended (all time)</h2>
        <div v-for="o in outcomes" :key="o.state" class="space-y-1">
          <div class="flex items-center justify-between gap-2 text-sm">
            <StatusBadge :state="o.state" />
            <span class="font-mono text-muted-foreground tabular-nums">{{ o.n }} strategies · {{ gp(o.est_realized_gp) }}</span>
          </div>
          <div class="h-2.5 bg-muted"><div class="h-full bg-chart-1" :style="{ width: `${o.pct}%` }" /></div>
        </div>
        <p v-if="cal?.failure_modes?.length" class="text-xs text-muted-foreground">
          Kill reasons: {{ cal.failure_modes.slice(0, 4).map((f) => `${f.archetype} ${f.mode.replace(/_/g, ' ')} ${f.n}`).join(', ') }}.
        </p>
      </section>

      <section class="space-y-3 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">By lane: realized inside projected</h2>
        <div v-for="l in laneBars" :key="l.archetype" class="space-y-1">
          <div class="flex justify-between gap-2 text-sm">
            <span>{{ l.archetype }} lane · {{ l.n }} strategies</span>
            <span class="font-mono text-muted-foreground tabular-nums">
              {{ gp(l.est_realized_gp) }} of {{ gp(l.projected_gp) }} · {{ l.projected_gp > 0 ? Math.round((l.est_realized_gp / l.projected_gp) * 100) : 0 }}%
            </span>
          </div>
          <div class="h-4 border bg-muted/40"><div class="h-full" :style="{ width: `${l.pct}%`, background: l.color }" /></div>
        </div>
        <p class="text-xs text-muted-foreground">Each bar is its own lane's projection; lanes differ by orders of magnitude.</p>
      </section>
    </div>

    <div class="grid gap-4 lg:grid-cols-2">
      <section v-for="board in [{ title: `Best five closed, ${win.long}`, rows: best, good: true }, { title: `Worst five closed, ${win.long}`, rows: worst, good: false }]" :key="board.title" class="space-y-2 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">{{ board.title }}</h2>
        <ol>
          <li v-for="r in board.rows" :key="r.strategy_id">
            <RouterLink :to="`/book/${r.strategy_id}`" class="flex items-center gap-3 border-b py-2.5 hover:bg-muted/30">
              <span class="flex size-10 shrink-0 items-center justify-center border bg-muted/40"><ItemIcon :icon="r.icon" /></span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm">{{ rowName(r) }}</span>
                <span class="block truncate font-mono text-[11px] text-muted-foreground">{{ r.archetype }} #{{ r.strategy_id }} · {{ r.state }} · {{ r.title }}</span>
              </span>
              <span class="font-mono text-sm tabular-nums" :class="(r.est_realized_gp ?? 0) < 0 ? 'text-destructive' : 'text-success'">
                {{ (r.est_realized_gp ?? 0) > 0 ? '+' : '' }}{{ gp(r.est_realized_gp) }}
              </span>
            </RouterLink>
          </li>
          <li v-if="!board.rows.length" class="py-2 text-sm text-muted-foreground">Nothing closed in this window.</li>
        </ol>
      </section>
    </div>

    <section>
      <div class="mb-2">
        <h2 class="text-sm font-medium">Per strategy (largest effect first)</h2>
        <p v-if="pnl.quarantined?.n" class="mt-0.5 text-xs text-muted-foreground">
          {{ pnl.quarantined.n }} quarantined strategies (known-bad or pre-restart numbers) are left out.
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Strategy</TableHead>
            <TableHead>State</TableHead>
            <TableHead class="text-right">Hours</TableHead>
            <TableHead class="text-right">Est. realized</TableHead>
            <TableHead class="text-right">Projected</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="r in rows" :key="r.strategy_id">
            <TableCell class="max-w-sm">
              <RouterLink :to="`/book/${r.strategy_id}`" class="flex items-center gap-2 hover:underline">
                <ItemIcon :icon="r.icon" />
                <span class="min-w-0">
                  <span class="block truncate font-medium">{{ r.title }}</span>
                  <span class="block font-mono text-xs text-muted-foreground">
                    {{ r.sid }}
                    <Badge v-if="r.sim_scored" variant="outline" class="ml-1 text-[10px]">sim</Badge>
                  </span>
                </span>
              </RouterLink>
            </TableCell>
            <TableCell><StatusBadge :state="r.state" /></TableCell>
            <TableCell class="text-right tabular-nums">{{ r.hours.toFixed(1) }}</TableCell>
            <TableCell class="text-right font-medium tabular-nums">{{ gp(r.est_realized_gp) }}</TableCell>
            <TableCell class="text-right text-muted-foreground tabular-nums">{{ gp(r.projected_gp) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Button v-if="!showAll && pnl.strategies.length > 25" variant="ghost" size="sm" class="mt-2" @click="showAll = true">
        show all {{ pnl.strategies.length }}
      </Button>
    </section>
  </div>
</template>
