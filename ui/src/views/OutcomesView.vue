<script setup lang="ts">
// Outcomes: what's running, what died and why, and whether it made money. Every
// strategy shipped or alive in the window, in plain words. The status cards are
// the legend and the filter at once. All of it is paper: nothing here traded gp.
import { Button } from '@fisherrjd/ui/button'
import { PageHeader } from '@fisherrjd/ui/layout'
import { EmptyState, ErrorState } from '@fisherrjd/ui/states'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fisherrjd/ui/table'
import { computed, onMounted, ref, watch } from 'vue'
import OutcomeRow from '@/components/OutcomeRow.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import WindowPicker from '@/components/WindowPicker.vue'
import { api, gp, type Outcome } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import { median } from '@/lib/runs'
import { hoursText, STATE_INFO, testProgress, whyClosed } from '@/lib/status'
import { earnedIn, FOLLOW_ALL_NOTE, measureNotes, useTimeWindow } from '@/lib/window'

const PAGE = 25
const HOUR = 3600_000

const { win } = useTimeWindow()
const all = ref<Outcome[]>([]) // this window and the one before it, for the comparison
const asOf = ref(Date.now())
const loading = ref(true)
const error = ref<string | null>(null)

const filter = ref<string | null>(null)
const closedSort = ref<'newest' | 'biggest'>('newest')
const showAllClosed = ref(false)
const showAllRunning = ref(false)

const from = computed(() =>
  win.value.hours === null ? Math.min(asOf.value, ...all.value.map((o) => Date.parse(o.opened_at))) : asOf.value - win.value.hours * HOUR,
)

// the server's rule for "in the window": shipped in it, or alive for some of it
function inWindow(o: Outcome): boolean {
  if (win.value.hours === null) return true
  if (Date.parse(o.opened_at) >= from.value) return true
  return o.state !== 'vetoed' && (!o.closed_at || Date.parse(o.closed_at) >= from.value)
}
const rows = computed(() => all.value.filter(inWindow))
const isRunning = (o: Outcome) => o.state === 'open' || o.state === 'armed'

const STATES = ['open', 'confirmed', 'expired', 'killed', 'vetoed'] as const
const stateOf = (o: Outcome) => (o.state === 'armed' ? 'open' : o.state)
const cards = computed(() =>
  STATES.map((state) => {
    const of = rows.value.filter((o) => stateOf(o) === state)
    const counted = of.filter((o) => o.est_realized_gp !== null)
    const sum = counted.reduce((s, o) => s + o.est_realized_gp!, 0)
    return { state, n: of.length, sum, counted: counted.length, info: STATE_INFO[state] }
  }),
)

// paper gp earned inside the window, spread over the hours each strategy traded
const earned = computed(() => earnedIn(rows.value, asOf.value, from.value, asOf.value))
const earnedBefore = computed(() =>
  win.value.hours === null ? null : earnedIn(all.value, asOf.value, from.value - win.value.hours * HOUR, from.value),
)
// the comparison window counts too: its figure sits right beside this one
const notes = computed(() => measureNotes(win.value.hours === null ? from.value : from.value - win.value.hours * HOUR, asOf.value))
const closedRows = computed(() => rows.value.filter((o) => o.closed_at && o.state !== 'vetoed' && Date.parse(o.closed_at) >= from.value))
const priced = computed(() => closedRows.value.filter((o) => o.est_realized_gp !== null))
const gains = computed(() => priced.value.filter((o) => o.est_realized_gp! > 0).length)
const shippedRows = computed(() => rows.value.filter((o) => Date.parse(o.opened_at) >= from.value))
const passRate = computed(() => {
  const n = closedRows.value.length
  return n ? closedRows.value.filter((o) => o.state === 'confirmed').length / n : null
})
const medianLife = computed(() => median(closedRows.value.map((o) => o.hours)))

// why things closed badly, by the reason in words
const deaths = computed(() => {
  const by = new Map<string, { n: number; sum: number | null }>()
  for (const o of closedRows.value) {
    if (o.state !== 'killed' && o.state !== 'expired') continue
    const key = whyClosed(o)?.headline ?? 'Unknown'
    const cur = by.get(key) ?? { n: 0, sum: null }
    cur.n++
    if (o.est_realized_gp !== null) cur.sum = (cur.sum ?? 0) + o.est_realized_gp
    by.set(key, cur)
  }
  const max = Math.max(1, ...[...by.values()].map((v) => v.n))
  return [...by.entries()].sort((a, b) => b[1].n - a[1].n).map(([why, v]) => ({ why, ...v, pct: (v.n / max) * 100 }))
})

// research or evaluate: is the cheap mode shipping things that hold up?
const bySource = computed(() =>
  ['research', 'evaluate'].map((mode) => {
    const of = rows.value.filter((o) => o.run_mode === mode && Date.parse(o.opened_at) >= from.value)
    const traded = of.filter((o) => o.state !== 'vetoed')
    const closed = traded.filter((o) => o.closed_at)
    const counted = traded.filter((o) => o.est_realized_gp !== null)
    const est = counted.reduce((s, o) => s + o.est_realized_gp!, 0)
    const plan = counted.reduce((s, o) => s + (o.projected_gp ?? 0), 0)
    return {
      mode,
      shipped: traded.length,
      vetoed: of.length - traded.length,
      running: traded.length - closed.length,
      proven: closed.filter((o) => o.state === 'confirmed').length,
      killed: closed.filter((o) => o.state === 'killed').length,
      timedOut: closed.filter((o) => o.state === 'expired').length,
      life: median(closed.map((o) => o.hours)),
      est,
      plan,
    }
  }),
)

const passesFilter = (o: Outcome) => filter.value === null || stateOf(o) === filter.value
const running = computed(() =>
  rows.value
    .filter((o) => isRunning(o) && passesFilter(o))
    .sort((a, b) => {
      // the ones in trouble first, then the ones furthest through their test
      const rank = (o: Outcome) => ({ 'at risk': 0, behind: 1, 'too early': 2, waiting: 3, 'on track': 4 })[testProgress(o).call]
      return rank(a) - rank(b) || b.hours - a.hours
    }),
)
const closed = computed(() => {
  const list = rows.value.filter((o) => !isRunning(o) && o.state !== 'vetoed' && passesFilter(o))
  return closedSort.value === 'newest'
    ? list.sort((a, b) => Date.parse(b.closed_at!) - Date.parse(a.closed_at!))
    : list.sort((a, b) => Math.abs(b.est_realized_gp ?? 0) - Math.abs(a.est_realized_gp ?? 0))
})
const vetoed = computed(() => rows.value.filter((o) => o.state === 'vetoed' && passesFilter(o)))
const vetoReasons = computed(() => {
  const by = new Map<string, number>()
  for (const o of vetoed.value) {
    const h = whyClosed(o)?.headline ?? 'Refused'
    by.set(h, (by.get(h) ?? 0) + 1)
  }
  return [...by.entries()].sort((a, b) => b[1] - a[1]).map(([h, n]) => `${n} ${h.toLowerCase()}`).join(' · ')
})
const showVetoed = ref(false)

let seq = 0
async function fetchAll() {
  const my = ++seq
  const hours = win.value.hours
  const res = await api.outcomes(hours === null ? null : hours * 2)
  if (my !== seq) return // the window changed while this was in flight
  all.value = res.rows
  asOf.value = Date.parse(res.as_of)
}
const { updatedAt, refreshError, markUpdated } = useAutoRefresh(fetchAll)

async function load() {
  loading.value = true
  error.value = null
  const pending = fetchAll()
  const my = seq // the number fetchAll just took
  try {
    await pending
    if (my === seq) markUpdated()
  } catch (e) {
    if (my === seq) error.value = String(e)
  } finally {
    if (my === seq) loading.value = false
  }
}
onMounted(load)
watch(win, () => {
  showAllClosed.value = false
  showAllRunning.value = false
  load()
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Outcomes" description="What's running, what died and why, and whether it made money. All paper: nothing here traded real gp.">
      <template #actions>
        <UpdatedAgo :updated-at="updatedAt" :error="refreshError" />
        <WindowPicker />
      </template>
    </PageHeader>

    <ErrorState v-if="error" title="Outcomes unavailable" :description="error" />
    <template v-else>
      <section aria-label="What each status means. Click one to filter." class="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
        <button
          v-for="c in cards"
          :key="c.state"
          type="button"
          class="flex flex-col gap-1.5 rounded-md border bg-card p-3 text-left hover:border-primary"
          :class="filter === c.state ? 'border-primary ring-1 ring-primary' : ''"
          :aria-pressed="filter === c.state"
          @click="filter = filter === c.state ? null : c.state"
        >
          <span class="flex items-center justify-between gap-2">
            <StatusBadge :state="c.state" />
            <span class="font-mono text-xl font-medium tabular-nums">{{ c.n }}</span>
          </span>
          <span class="text-xs text-muted-foreground">{{ c.info.meaning }}</span>
          <span class="mt-auto font-mono text-[11px] text-muted-foreground tabular-nums">
            {{ c.state === 'vetoed' ? 'never traded' : c.counted ? `${c.sum > 0 ? '+' : ''}${gp(c.sum)} paper` : 'no gp figure' }}
          </span>
        </button>
      </section>

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          :label="`Paper earned, ${win.label}`"
          :value="`${earned > 0 ? '+' : ''}${gp(earned)}`"
          :signed="earned"
          :hint="earnedBefore !== null ? `${win.before}: ${gp(earnedBefore)}` : 'lane P not counted'"
        />
        <StatTile
          label="Closed with a gain"
          :value="`${gains} of ${priced.length}`"
          :hint="priced.length ? `${priced.length - gains} flat or down` : 'nothing closed'"
        />
        <StatTile
          label="Passed the test"
          :value="passRate === null ? '—' : `${Math.round(passRate * 100)}%`"
          :hint="medianLife !== null ? `${closedRows.length} closed · median ${hoursText(medianLife)}` : 'nothing closed'"
        />
        <StatTile
          label="Shipped"
          :value="String(shippedRows.filter((o) => o.state !== 'vetoed').length)"
          :hint="`${shippedRows.filter((o) => o.state === 'vetoed').length} more vetoed`"
        />
      </div>
      <p class="text-xs text-muted-foreground">{{ FOLLOW_ALL_NOTE }} <template v-for="n in notes" :key="n">{{ n }} </template></p>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="space-y-3 rounded-md border bg-card p-4">
          <h2 class="text-sm font-medium">Why they died</h2>
          <p v-if="!deaths.length" class="text-sm text-muted-foreground">Nothing killed or timed out in this window.</p>
          <div v-for="d in deaths" :key="d.why" class="flex items-center gap-3">
            <span class="w-40 shrink-0 text-sm">{{ d.why }}</span>
            <div class="h-3 flex-1 bg-muted"><div class="h-full bg-destructive" :style="{ width: `${d.pct}%` }" /></div>
            <span class="w-8 text-right font-mono text-sm tabular-nums">{{ d.n }}</span>
            <span class="w-16 text-right font-mono text-xs text-muted-foreground tabular-nums">{{ d.sum !== null && d.sum > 0 ? '+' : '' }}{{ gp(d.sum) }}</span>
          </div>
          <p v-if="deaths.length" class="text-xs text-muted-foreground">The gp column is what those strategies earned on paper before they closed.</p>
        </section>

        <section class="min-w-0 space-y-2 rounded-md border bg-card p-4">
          <h2 class="text-sm font-medium">Where they came from</h2>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Run type</TableHead>
                  <TableHead class="text-right">Shipped</TableHead>
                  <TableHead class="text-right">Running</TableHead>
                  <TableHead class="text-right">Proven</TableHead>
                  <TableHead class="text-right">Killed</TableHead>
                  <TableHead class="text-right">Median life</TableHead>
                  <TableHead class="text-right">Paper / plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="s in bySource" :key="s.mode">
                  <TableCell class="capitalize">{{ s.mode }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ s.shipped }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ s.running }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ s.proven }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ s.killed }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ s.life === null ? '—' : hoursText(s.life) }}</TableCell>
                  <TableCell class="text-right font-mono text-xs tabular-nums">{{ gp(s.est) }} / {{ gp(s.plan) }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <p class="text-xs text-muted-foreground">Strategies shipped in this window, by the kind of run that shipped them. Lane P adds no gp to the last column.</p>
        </section>
      </div>

      <section v-if="running.length" class="rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">Still running ({{ running.length }})</h2>
        <p class="mb-1 text-xs text-muted-foreground">Trouble first. Each must stay healthy and keep pace to be proven at the end of its test.</p>
        <OutcomeRow v-for="o in showAllRunning ? running : running.slice(0, PAGE)" :key="o.strategy_id" :o="o" />
        <Button v-if="!showAllRunning && running.length > PAGE" variant="ghost" size="sm" class="mt-2" @click="showAllRunning = true">show all {{ running.length }}</Button>
      </section>

      <section v-if="closed.length" class="rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium">Closed ({{ closed.length }})</h2>
          <div class="flex gap-1" role="group" aria-label="Sort closed strategies">
            <Button :variant="closedSort === 'newest' ? 'secondary' : 'ghost'" size="sm" :aria-pressed="closedSort === 'newest'" @click="closedSort = 'newest'">Newest</Button>
            <Button :variant="closedSort === 'biggest' ? 'secondary' : 'ghost'" size="sm" :aria-pressed="closedSort === 'biggest'" @click="closedSort = 'biggest'">Biggest</Button>
          </div>
        </div>
        <OutcomeRow v-for="o in showAllClosed ? closed : closed.slice(0, PAGE)" :key="o.strategy_id" :o="o" />
        <Button v-if="!showAllClosed && closed.length > PAGE" variant="ghost" size="sm" class="mt-2" @click="showAllClosed = true">show all {{ closed.length }}</Button>
      </section>

      <section v-if="vetoed.length" class="rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 class="text-sm font-medium">Vetoed ({{ vetoed.length }})</h2>
            <p class="text-xs text-muted-foreground">{{ vetoReasons }}</p>
          </div>
          <Button variant="ghost" size="sm" :aria-expanded="showVetoed" @click="showVetoed = !showVetoed">{{ showVetoed ? 'hide' : 'show' }}</Button>
        </div>
        <template v-if="showVetoed">
          <OutcomeRow v-for="o in vetoed.slice(0, 200)" :key="o.strategy_id" :o="o" />
        </template>
      </section>

      <EmptyState
        v-if="!loading && !running.length && !closed.length && !vetoed.length"
        title="Nothing here"
        :description="filter ? 'No strategies with this status in this window.' : 'No strategies in this window.'"
      />
    </template>
  </div>
</template>
