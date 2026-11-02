<script setup lang="ts">
// Run health: what the engine is doing now, and how the runs in the chosen
// window went. A live panel, the window's totals against the window before,
// every run at its real time, research and evaluate side by side (their costs
// differ a hundredfold, so one median would describe neither), failures by kind,
// what recent runs shipped, then the run table.
import { Badge } from '@fisherrjd/ui/badge'
import { Button } from '@fisherrjd/ui/button'
import { PageHeader } from '@fisherrjd/ui/layout'
import { ErrorState } from '@fisherrjd/ui/states'
import { Switch } from '@fisherrjd/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fisherrjd/ui/table'
import { PlayIcon } from '@lucide/vue'
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ItemIcon from '@/components/ItemIcon.vue'
import LineChart from '@/components/LineChart.vue'
import LiveRun from '@/components/LiveRun.vue'
import RunDayBars from '@/components/RunDayBars.vue'
import RunTimeline from '@/components/RunTimeline.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import WindowPicker from '@/components/WindowPicker.vue'
import { api, duration, timeAgo, tokens, type Run } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import { median, OUTCOME, runOutcome } from '@/lib/runs'
import { FAIL_KIND_LABEL } from '@/lib/strategy'
import { useTimeWindow } from '@/lib/window'

const HOUR = 3600_000
const TABLE_PAGE = 100

const router = useRouter()
const { win } = useTimeWindow()
const fetched = ref<Run[]>([]) // newest first: this window and the one before it
const asOf = ref(Date.now())
const loading = ref(true)
const error = ref<string | null>(null)
// most cron runs legitimately ship nothing; the table hides them by default
// (failures always show)
const shippedOnly = ref(true)
const showAllRows = ref(false)

const from = computed(() => {
  if (win.value.hours !== null) return asOf.value - win.value.hours * HOUR
  const oldest = fetched.value.at(-1)
  return oldest ? Date.parse(oldest.started_at) : asOf.value
})
const runs = computed(() => fetched.value.filter((r) => Date.parse(r.started_at) >= from.value))
const prevRuns = computed(() =>
  win.value.hours === null ? null : fetched.value.filter((r) => Date.parse(r.started_at) < from.value),
)
// the timeline draws runs one by one; past a week they would overlap
const perRun = computed(() => win.value.hours !== null && win.value.hours <= 168)

const totalTokens = (rs: Run[]) => rs.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0)
const liveShips = (r: Run) => (r.shipped ?? []).filter((s) => s.state !== 'vetoed').length
const failedCount = (rs: Run[]) => rs.filter((r) => r.status === 'failed').length
const ended = (rs: Run[]) => rs.filter((r) => r.status !== 'running')
const okRate = (rs: Run[]) => {
  const done = ended(rs)
  return done.length ? (done.length - failedCount(done)) / done.length : null
}
const pctText = (x: number | null) => (x === null ? '—' : `${Math.round(x * 100)}%`)

const counts = computed(() => {
  const c = { shipped: 0, vetoed: 0, empty: 0, failed: 0, running: 0 }
  for (const r of runs.value) c[runOutcome(r)]++
  return c
})
const shippedTotal = computed(() => runs.value.reduce((s, r) => s + liveShips(r), 0))
const vetoedTotal = computed(() => runs.value.reduce((s, r) => s + (r.shipped ?? []).filter((x) => x.state === 'vetoed').length, 0))

const modes = computed(() =>
  (['research', 'evaluate'] as const).map((mode) => {
    const rs = runs.value.filter((r) => (r.mode ?? 'research') === mode)
    const done = ended(rs)
    return {
      mode,
      n: rs.length,
      failed: failedCount(rs),
      minutes: median(done.filter((r) => r.finished_at).map((r) => (Date.parse(r.finished_at!) - Date.parse(r.started_at)) / 60_000)),
      tokens: median(done.filter((r) => r.input_tokens != null).map((r) => r.input_tokens! + (r.output_tokens ?? 0))),
      total: totalTokens(rs),
      ships: rs.reduce((s, r) => s + liveShips(r), 0),
      blurb:
        mode === 'research'
          ? 'Full tool access, on a timer. The model hunts for strategies itself.'
          : 'A script builds the candidates when something new shows up; the model only judges them.',
    }
  }),
)
const tokenSplit = computed(() => {
  const total = totalTokens(runs.value)
  if (!total) return 'none spent'
  return `${Math.round((modes.value[0].total / total) * 100)}% research`
})

// share of the last 10 runs that did not fail, at each run
const rolling = computed(() => {
  const o = [...runs.value].reverse()
  const out: { t: number; v: number | null }[] = []
  for (let i = 9; i < o.length; i++) {
    const ok = o.slice(i - 9, i + 1).filter((r) => r.status !== 'failed').length
    out.push({ t: Date.parse(o[i].started_at), v: ok * 10 })
  }
  return out
})

const failures = computed(() => {
  const failed = runs.value.filter((r) => r.status === 'failed')
  const by = new Map<string, { n: number; details: Map<string, number> }>()
  for (const r of failed) {
    const kind = r.fail_kind ?? 'unclassified'
    const cur = by.get(kind) ?? { n: 0, details: new Map() }
    cur.n++
    if (r.fail_detail) cur.details.set(r.fail_detail, (cur.details.get(r.fail_detail) ?? 0) + 1)
    by.set(kind, cur)
  }
  const max = Math.max(1, ...[...by.values()].map((v) => v.n))
  return [...by.entries()]
    .sort((a, b) => b[1].n - a[1].n)
    .map(([kind, v]) => ({
      kind,
      label: FAIL_KIND_LABEL[kind] ?? kind,
      n: v.n,
      pct: (v.n / max) * 100,
      top: [...v.details.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3),
    }))
})

const recentShips = computed(() => runs.value.filter((r) => r.shipped?.length).slice(0, 6))

const visible = computed(() =>
  shippedOnly.value ? runs.value.filter((r) => r.n_strategies > 0 || r.status !== 'succeeded') : runs.value,
)
const tableRows = computed(() => (showAllRows.value ? visible.value : visible.value.slice(0, TABLE_PAGE)))

const triggerLabel: Record<string, string> = { schedule: 'timer', signal: 'signal', empty: 'empty book', manual: 'manual' }

let seq = 0
async function fetchAll() {
  const my = ++seq
  const hours = win.value.hours
  const res = await api.runsSince(hours === null ? null : hours * 2)
  if (my !== seq) return // the window changed while this was in flight
  fetched.value = res
  asOf.value = Date.now()
}
const { updatedAt, refreshError, markUpdated } = useAutoRefresh(fetchAll)

async function load() {
  loading.value = true
  error.value = null
  try {
    await fetchAll()
    markUpdated()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
}
onMounted(load)
watch(win, () => {
  showAllRows.value = false
  load()
})

async function trigger() {
  try {
    const { run_id } = await api.triggerRun()
    toast.success(`run ${run_id} started`)
    router.push(`/runs/${run_id}`)
  } catch (e) {
    toast.error(String(e))
  }
}
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Run health" :description="`What the engine is doing now, and how its runs went, ${win.long}.`">
      <template #actions>
        <UpdatedAgo :updated-at="updatedAt" :error="refreshError" />
        <WindowPicker />
        <Button size="sm" @click="trigger"><PlayIcon /> Trigger run</Button>
      </template>
    </PageHeader>

    <ErrorState v-if="error" title="Runs unavailable" :description="error" />
    <template v-else>
      <LiveRun :runs="fetched" @changed="fetchAll" />

      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Runs"
          :value="String(runs.length)"
          :hint="prevRuns ? `${win.before}: ${prevRuns.length}` : `${counts.empty + counts.vetoed} shipped nothing`"
        />
        <StatTile
          label="Finished clean"
          :value="pctText(okRate(runs))"
          :hint="`${counts.failed} failed${prevRuns ? ` · before: ${pctText(okRate(prevRuns))}` : ''}`"
        />
        <StatTile
          label="Strategies shipped"
          :value="String(shippedTotal)"
          :hint="`from ${counts.shipped} runs · ${vetoedTotal} more vetoed`"
        />
        <StatTile
          label="Tokens"
          :value="tokens(totalTokens(runs))"
          :hint="prevRuns ? `${tokenSplit} · before: ${tokens(totalTokens(prevRuns))}` : tokenSplit"
        />
      </div>

      <section class="space-y-2 rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-sm font-medium">{{ perRun ? 'Every run, at the time it ran' : 'Runs per day' }}</h2>
          <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span v-for="k in (['shipped', 'empty', 'vetoed', 'failed'] as const)" :key="k" class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-[1px]" :style="{ background: OUTCOME[k].color }" />{{ OUTCOME[k].label }}
            </span>
          </div>
        </div>
        <RunTimeline v-if="perRun" :runs="runs" :from="from" :to="asOf" />
        <RunDayBars v-else :runs="runs" />
        <p class="text-xs text-muted-foreground">
          Shipped: at least one strategy went on paper. Shipped nothing: it looked and nothing cleared the bar, a valid result. All vetoed: it pitched, the rules refused every one. Failed: it broke before finishing.
        </p>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="min-w-0 space-y-2 rounded-md border bg-card p-4">
          <h2 class="text-sm font-medium">Research and evaluate runs</h2>
          <div class="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mode</TableHead>
                  <TableHead class="text-right">Runs</TableHead>
                  <TableHead class="text-right">Failed</TableHead>
                  <TableHead class="text-right">Typical time</TableHead>
                  <TableHead class="text-right">Typical tokens</TableHead>
                  <TableHead class="text-right">All tokens</TableHead>
                  <TableHead class="text-right">Shipped</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow v-for="m in modes" :key="m.mode">
                  <TableCell class="capitalize">{{ m.mode }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ m.n }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ m.failed }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ m.minutes === null ? '—' : `${Math.max(1, Math.round(m.minutes))}m` }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ tokens(m.tokens) }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ tokens(m.total) }}</TableCell>
                  <TableCell class="text-right tabular-nums">{{ m.ships }}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
          <ul class="space-y-0.5 text-xs text-muted-foreground">
            <li v-for="m in modes" :key="m.mode"><span class="capitalize">{{ m.mode }}</span>: {{ m.blurb }}</li>
          </ul>
        </section>

        <section class="space-y-3 rounded-md border bg-card p-4">
          <h2 class="text-sm font-medium">Why runs failed</h2>
          <p v-if="!failures.length" class="text-sm text-muted-foreground">No failures in this window.</p>
          <div v-for="f in failures" :key="f.kind" class="space-y-1">
            <div class="flex items-center gap-3">
              <span class="w-40 shrink-0 text-sm">{{ f.label }}</span>
              <div class="h-3 flex-1 bg-muted">
                <div class="h-full" :class="f.kind === 'restart' ? 'bg-muted-foreground' : 'bg-destructive'" :style="{ width: `${f.pct}%` }" />
              </div>
              <span class="w-8 text-right font-mono text-sm tabular-nums">{{ f.n }}</span>
            </div>
            <ul v-if="f.top.length" class="ml-40 space-y-0.5 pl-3 text-xs text-muted-foreground">
              <li v-for="[d, n] in f.top" :key="d" class="truncate" :title="d"><span class="font-mono">{{ n }}×</span> {{ d }}</li>
            </ul>
          </div>
        </section>
      </div>

      <section v-if="!perRun && rolling.length" class="space-y-2 rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-sm font-medium">Success rate, rolling 10 runs</h2>
          <span class="text-xs text-muted-foreground">
            last 10: <strong class="font-mono text-foreground">{{ rolling.at(-1)!.v }}%</strong> · worst stretch
            {{ Math.min(...rolling.map((p) => p.v ?? 100)) }}%
          </span>
        </div>
        <LineChart
          :points="rolling"
          :height="180"
          :format="(v: number) => `${Math.round(v)}%`"
          label="Share of the last 10 runs that did not fail, at each run"
        />
      </section>

      <section v-if="recentShips.length" class="space-y-2 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">Latest runs that shipped, and how each strategy is doing now</h2>
        <ol>
          <li v-for="r in recentShips" :key="r.run_id" class="flex items-center gap-4 border-b py-3 last:border-b-0">
            <RouterLink :to="`/runs/${r.run_id}`" class="w-28 shrink-0 font-mono text-sm hover:underline">
              #{{ r.run_id }}
              <span class="block text-[11px] text-muted-foreground">{{ r.mode }}, {{ timeAgo(r.started_at) }}</span>
            </RouterLink>
            <div class="flex flex-wrap gap-2">
              <RouterLink
                v-for="sh in r.shipped"
                :key="sh.strategy_id"
                :to="`/book/${sh.strategy_id}`"
                class="inline-flex items-center gap-2 border bg-muted/30 py-1 pr-3 pl-1 hover:border-primary"
              >
                <ItemIcon :icon="sh.icon" />
                <span class="flex flex-col gap-0.5">
                  <span class="text-sm">{{ sh.primary_item_name ?? sh.title }}</span>
                  <StatusBadge :state="sh.state" class="self-start" />
                </span>
              </RouterLink>
            </div>
          </li>
        </ol>
      </section>

      <section class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium">Runs in this window</h2>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Switch v-model="shippedOnly" /> Hide empty runs
          </label>
        </div>
        <div class="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead class="w-20">Run</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Started</TableHead>
                <TableHead class="text-right">Took</TableHead>
                <TableHead class="text-right">Calls</TableHead>
                <TableHead class="text-right">Tokens</TableHead>
                <TableHead class="text-right">Shipped</TableHead>
                <TableHead>Failure</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              <TableRow v-for="r in tableRows" :key="r.run_id" class="cursor-pointer" @click="router.push(`/runs/${r.run_id}`)">
                <TableCell class="font-medium tabular-nums">
                  <RouterLink :to="`/runs/${r.run_id}`" @click.stop>#{{ r.run_id }}</RouterLink>
                </TableCell>
                <TableCell><StatusBadge :state="r.status" /></TableCell>
                <TableCell class="text-xs text-muted-foreground">{{ r.mode ?? '—' }}</TableCell>
                <TableCell class="text-xs text-muted-foreground">{{ r.trigger_source ? triggerLabel[r.trigger_source] : '—' }}</TableCell>
                <TableCell class="text-muted-foreground">{{ timeAgo(r.started_at) }}</TableCell>
                <TableCell class="text-right text-muted-foreground tabular-nums">{{ duration(r.started_at, r.finished_at) }}</TableCell>
                <TableCell class="text-right text-muted-foreground tabular-nums">{{ r.tool_calls ?? '—' }}</TableCell>
                <TableCell class="text-right text-muted-foreground tabular-nums">
                  {{ r.input_tokens != null ? tokens((r.input_tokens ?? 0) + (r.output_tokens ?? 0)) : '—' }}
                </TableCell>
                <TableCell class="text-right tabular-nums">{{ liveShips(r) }}</TableCell>
                <TableCell class="max-w-md text-xs text-muted-foreground" :title="r.fail_reason ?? ''">
                  <template v-if="r.status === 'failed'">
                    <Badge v-if="r.fail_kind" variant="outline" class="mr-1">{{ FAIL_KIND_LABEL[r.fail_kind] ?? r.fail_kind }}</Badge>
                    <span class="truncate">{{ r.fail_kind ? r.fail_detail : r.fail_reason }}</span>
                  </template>
                </TableCell>
              </TableRow>
              <TableRow v-if="!loading && visible.length === 0">
                <TableCell colspan="10" class="text-center text-muted-foreground">no runs in this window</TableCell>
              </TableRow>
            </TableBody>
          </Table>
        </div>
        <Button v-if="!showAllRows && visible.length > TABLE_PAGE" variant="ghost" size="sm" @click="showAllRows = true">show all {{ visible.length }}</Button>
      </section>
    </template>
  </div>
</template>
