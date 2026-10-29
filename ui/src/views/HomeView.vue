<script setup lang="ts">
// Command center: what needs a person right now. The needs-you queue (plain
// rules over the open book, lib/strategy.ts needsYou), when each strategy
// wants checking, one cycle of every strategy as a GE shopping list, the
// best processing recipes this hour, and what the next run will look at.
import { Button } from '@fisherrjd/ui/button'
import { PageHeader } from '@fisherrjd/ui/layout'
import { ErrorState } from '@fisherrjd/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fisherrjd/ui/table'
import { ActivityIcon, ArrowRightIcon, ScanSearchIcon } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import ItemIcon from '@/components/ItemIcon.vue'
import StatTile from '@/components/StatTile.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import { api, gp, timeAgo, type Health, type ProcessQuote, type Run, type Signal, type Strategy } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import { perWindow } from '@/lib/process'
import { cadence, legsOf, needsYou, projectedPerHour, shortName, type Severity } from '@/lib/strategy'
import { STATUS } from '@/lib/viz'

const book = ref<Strategy[]>([])
const signals = ref<Signal[]>([])
const quotes = ref<ProcessQuote[]>([])
const health = ref<Health | null>(null)
const lastRun = ref<Run | null>(null)
const error = ref<string | null>(null)

const SEVERITY: Record<Severity, { label: string; color: string }> = {
  critical: { label: 'critical', color: STATUS.critical },
  serious: { label: 'serious', color: STATUS.serious },
  warning: { label: 'warning', color: STATUS.warning },
  info: { label: 'info', color: 'hsl(var(--chart-3))' },
}

const alerts = computed(() => needsYou(book.value))
const alertSplit = computed(() => {
  const c: Partial<Record<Severity, number>> = {}
  for (const a of alerts.value) c[a.severity] = (c[a.severity] ?? 0) + 1
  return (Object.keys(SEVERITY) as Severity[]).filter((k) => c[k]).map((k) => `${c[k]} ${k}`).join(' · ') || 'all clear'
})
function alertIcon(s?: Strategy) {
  if (!s) return null
  return s.item_icons?.[String(s.primary_item_id)] ?? null
}

const committed = computed(() => book.value.reduce((s, x) => s + (x.capital_required ?? 0), 0))
const busiest = computed(() =>
  [...book.value].sort((a, b) => (b.attention_spec?.checks_per_hour ?? 0) - (a.attention_spec?.checks_per_hour ?? 0))[0],
)

// one tick per check over the next 12 hours, from each strategy's cadence
const HOURS = 12
const lanes = computed(() =>
  [...book.value]
    .sort((a, b) => (b.attention_spec?.checks_per_hour ?? 0) - (a.attention_spec?.checks_per_hour ?? 0))
    .map((s) => {
      const cph = s.attention_spec?.checks_per_hour ?? 0
      const ticks: number[] = []
      // no cadence on record: no ticks (not one at "now")
      if (cph > 0) for (let h = 0; h <= HOURS && ticks.length < 200; h += 1 / cph) ticks.push((h / HOURS) * 100)
      return { s, ticks, cadence: cadence(cph), n: ticks.length }
    }),
)
const hourLabels = computed(() => {
  const now = Date.now()
  return [0, 4, 8, 12].map((h) =>
    new Date(now + h * 3600_000).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: false }),
  )
})

// "placed" ticks are a per-viewer convenience for today, kept in this
// browser only, keyed by the viewer's LOCAL date (a UTC key would reset in
// the evening west of UTC); the page works the same without storage
const today = new Date()
const dayKey = `ge-placed-${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
function readPlaced(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(dayKey) ?? '{}')
  } catch {
    return {}
  }
}
const placed = ref<Record<string, boolean>>(readPlaced())
function togglePlaced(id: number) {
  placed.value = { ...placed.value, [id]: !placed.value[id] }
  try {
    localStorage.setItem(dayKey, JSON.stringify(placed.value))
  } catch {
    // storage blocked: the tick still holds for this visit
  }
}
const cycles = computed(() =>
  [...book.value]
    .sort((a, b) => (b.capital_required ?? 0) - (a.capital_required ?? 0))
    .map((s) => {
      const units = s.units_used ?? 1
      const legs = legsOf(s)
      return {
        s,
        buys: legs.filter((l) => l.side === 'buy').map((l) => ({ ...l, total: l.qty * units })),
        sells: legs.filter((l) => l.side === 'sell').map((l) => ({ ...l, total: l.qty * units })),
      }
    }),
)
const placedCount = computed(() => book.value.filter((s) => placed.value[s.strategy_id]).length)
const placedCap = computed(() =>
  book.value.filter((s) => placed.value[s.strategy_id]).reduce((sum, s) => sum + (s.capital_required ?? 0), 0),
)

const topProcess = computed(() => {
  const ranked = quotes.value.filter((q) => q.gp_hr !== null && q.gp_hr > 0).sort((a, b) => b.gp_hr! - a.gp_hr!).slice(0, 3)
  const max = ranked[0]?.gp_hr ?? 1
  return ranked.map((q) => ({ q, pct: (q.gp_hr! / max) * 100 }))
})

const pending = computed(() => {
  const by = new Map<string, number>()
  for (const s of signals.value) if (s.status === 'pending') by.set(s.kind, (by.get(s.kind) ?? 0) + 1)
  const max = Math.max(1, ...by.values())
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([kind, n]) => ({ kind, n, pct: (n / max) * 100 }))
})
const pendingTotal = computed(() => pending.value.reduce((s, p) => s + p.n, 0))

async function fetchAll() {
  const [b, sig, h, runs, q] = await Promise.all([
    api.openBook(),
    api.signals(200),
    api.health(),
    api.runs(1),
    api.process().catch(() => [] as ProcessQuote[]),
  ])
  book.value = b
  signals.value = sig
  health.value = h
  lastRun.value = runs[0] ?? null
  quotes.value = q
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
  <div class="space-y-6">
    <PageHeader title="Command center" description="What needs you, when to check, and what to do at the GE next.">
      <template #actions>
        <UpdatedAgo :updated-at="updatedAt" :error="refreshError" />
        <Button v-if="health?.active_run_id" variant="outline" size="sm" as-child>
          <RouterLink :to="`/runs/${health.active_run_id}`">
            <ActivityIcon class="animate-pulse" /> run #{{ health.active_run_id }} live
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <ErrorState v-if="error" title="Dashboard data unavailable" :description="error" />
    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Needs you" :value="String(alerts.length)" :hint="alertSplit" />
        <StatTile
          label="Busiest check"
          :value="busiest ? cadence(busiest.attention_spec?.checks_per_hour) : '—'"
          :hint="busiest ? `#${busiest.strategy_id} ${shortName(busiest)}` : 'nothing open'"
        />
        <StatTile label="Cycles placed today" :value="`${placedCount} / ${book.length}`" :hint="`${gp(placedCap)} of ${gp(committed)} placed`" />
        <StatTile
          label="Engine"
          :value="health?.active_run_id ? 'researching' : health?.ok ? 'idle' : 'unhealthy'"
          :hint="lastRun ? `last run #${lastRun.run_id} ${lastRun.status}, ${timeAgo(lastRun.started_at)}` : 'no runs yet'"
        />
      </div>

      <div class="grid gap-4 xl:grid-cols-[3fr_2fr]">
        <section class="min-w-0 space-y-3 rounded-md border bg-card p-4">
          <h2 class="text-sm font-medium">Needs you</h2>
          <p v-if="!alerts.length" class="text-sm text-muted-foreground">Nothing needs you right now.</p>
          <ol class="space-y-2">
            <li
              v-for="(a, i) in alerts"
              :key="i"
              class="flex items-start gap-3 border border-l-[3px] bg-muted/20 p-3"
              :style="{ borderLeftColor: SEVERITY[a.severity].color }"
            >
              <span class="flex size-10 shrink-0 items-center justify-center border bg-muted/40">
                <ItemIcon v-if="alertIcon(a.strategy)" :icon="alertIcon(a.strategy)" />
                <ScanSearchIcon v-else class="size-5 text-muted-foreground" aria-hidden="true" />
              </span>
              <div class="min-w-0 flex-1 space-y-0.5">
                <div class="flex flex-wrap items-baseline gap-2">
                  <span
                    class="border px-1.5 font-mono text-[10px] tracking-wider uppercase"
                    :style="{ borderColor: SEVERITY[a.severity].color, color: SEVERITY[a.severity].color }"
                  >
                    {{ SEVERITY[a.severity].label }}
                  </span>
                  <span class="text-sm font-medium">{{ a.title }}</span>
                </div>
                <p class="text-xs text-muted-foreground">{{ a.why }}</p>
              </div>
              <Button variant="outline" size="sm" as-child class="self-center">
                <RouterLink :to="a.strategy ? `/book/${a.strategy.strategy_id}` : '/book'">Open</RouterLink>
              </Button>
            </li>
          </ol>
        </section>

        <section class="min-w-0 space-y-3 rounded-md border bg-card p-4">
          <div>
            <h2 class="text-sm font-medium">Check schedule, next {{ HOURS }}h</h2>
            <p class="text-xs text-muted-foreground">From each strategy's check cadence, starting now. One tick per check.</p>
          </div>
          <div class="space-y-2">
            <div v-for="l in lanes" :key="l.s.strategy_id" class="flex items-center gap-2">
              <RouterLink :to="`/book/${l.s.strategy_id}`" :title="shortName(l.s)" class="shrink-0">
                <ItemIcon :icon="l.s.item_icons?.[String(l.s.primary_item_id)]" :name="shortName(l.s)" />
              </RouterLink>
              <span class="w-20 shrink-0 font-mono text-[11px] text-muted-foreground">{{ l.cadence }}</span>
              <div class="relative h-5 flex-1 border-b" role="img" :aria-label="l.n ? `${shortName(l.s)}: ${l.n} checks in the next ${HOURS} hours` : `${shortName(l.s)}: no check cadence on record`">
                <span v-for="(t, i) in l.ticks" :key="i" class="absolute top-0.5 h-4 w-0.5 bg-chart-1" :style="{ left: `calc(${t}% - 1px)` }" />
              </div>
            </div>
          </div>
          <div class="flex justify-between pl-32 font-mono text-[10px] text-muted-foreground">
            <span v-for="h in hourLabels" :key="h">{{ h }}</span>
          </div>
        </section>
      </div>

      <section class="space-y-2 rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-sm font-medium">At the GE: one cycle of each strategy</h2>
          <span class="text-xs text-muted-foreground">Tick a row once its offers are in (kept in this browser, today only).</span>
        </div>
        <div class="overflow-x-auto">
          <Table class="min-w-[760px]">
            <TableHeader>
              <TableRow>
                <TableHead class="w-10"><span class="sr-only">Placed</span></TableHead>
                <TableHead>Buy</TableHead>
                <TableHead>Sell</TableHead>
                <TableHead class="text-right">Cost</TableHead>
                <TableHead class="text-right">Projected</TableHead>
                <TableHead class="text-right">Check</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="c in cycles" :key="c.s.strategy_id" :class="placed[c.s.strategy_id] ? 'opacity-50' : ''">
                <TableCell>
                  <input
                    :id="`placed-${c.s.strategy_id}`"
                    type="checkbox"
                    class="size-5 accent-primary"
                    :checked="!!placed[c.s.strategy_id]"
                    @change="togglePlaced(c.s.strategy_id)"
                  />
                </TableCell>
                <TableCell>
                  <label :for="`placed-${c.s.strategy_id}`" class="flex cursor-pointer flex-wrap items-center gap-2">
                    <span v-for="b in c.buys" :key="b.item_id" class="inline-flex items-center gap-0.5" :title="b.name">
                      <ItemIcon :icon="b.icon" :name="b.name" />
                      <span class="font-mono text-xs text-muted-foreground tabular-nums">×{{ b.total.toLocaleString() }}</span>
                    </span>
                    <span class="text-xs text-muted-foreground">#{{ c.s.strategy_id }} {{ shortName(c.s) }}</span>
                  </label>
                </TableCell>
                <TableCell>
                  <span v-for="x in c.sells" :key="x.item_id" class="inline-flex items-center gap-0.5" :title="x.name">
                    <ItemIcon :icon="x.icon" :name="x.name" />
                    <span class="font-mono text-xs text-primary-text tabular-nums">×{{ x.total.toLocaleString() }}</span>
                  </span>
                </TableCell>
                <TableCell class="text-right font-mono tabular-nums">{{ gp(c.s.capital_required) }}</TableCell>
                <TableCell class="text-right font-mono tabular-nums">{{ gp(projectedPerHour(c.s)) }}/hr</TableCell>
                <TableCell class="text-right font-mono text-muted-foreground">{{ cadence(c.s.attention_spec?.checks_per_hour) }}</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="space-y-2 rounded-md border bg-card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-medium">Best processing right now</h2>
            <Button variant="ghost" size="sm" as-child><RouterLink to="/process">all recipes <ArrowRightIcon /></RouterLink></Button>
          </div>
          <RouterLink
            v-for="(p, i) in topProcess"
            :key="p.q.recipe_id"
            :to="`/process/${p.q.recipe_id}`"
            class="flex items-center gap-3 border-b py-2.5 last:border-b-0 hover:bg-muted/30"
          >
            <span class="w-4 font-mono text-sm text-muted-foreground">{{ i + 1 }}</span>
            <ItemIcon :icon="p.q.icon" />
            <span class="min-w-0 flex-1 space-y-1">
              <span class="block truncate text-sm font-medium">{{ p.q.name }}</span>
              <span class="block h-1.5 bg-muted"><span class="block h-full bg-chart-1" :style="{ width: `${p.pct}%` }" /></span>
            </span>
            <span class="text-right">
              <span class="block font-mono text-sm tabular-nums">{{ gp(p.q.gp_hr) }}/hr</span>
              <span class="block font-mono text-[11px] text-muted-foreground tabular-nums">{{ gp(perWindow(p.q.gp_hr)) }} per 4h limit</span>
            </span>
          </RouterLink>
          <p v-if="!topProcess.length" class="text-sm text-muted-foreground">No profitable recipe priced right now.</p>
        </section>

        <section class="space-y-3 rounded-md border bg-card p-4">
          <div class="flex items-center justify-between">
            <h2 class="text-sm font-medium">Signals waiting for the next run ({{ pendingTotal }})</h2>
            <Button variant="ghost" size="sm" as-child><RouterLink to="/signals">signals <ArrowRightIcon /></RouterLink></Button>
          </div>
          <div v-for="p in pending" :key="p.kind" class="flex items-center gap-3">
            <span class="w-20 font-mono text-sm">{{ p.kind }}</span>
            <div class="h-3 flex-1 bg-muted"><div class="h-full bg-chart-3" :style="{ width: `${p.pct}%` }" /></div>
            <span class="w-8 text-right font-mono text-sm tabular-nums">{{ p.n }}</span>
          </div>
          <p v-if="!pending.length" class="text-sm text-muted-foreground">No signals pending.</p>
          <p class="text-xs text-muted-foreground">Signals feed the next run's brief; combo signals become C-lane candidates.</p>
        </section>
      </div>
    </template>
  </div>
</template>
