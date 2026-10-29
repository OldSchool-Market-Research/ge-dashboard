<script setup lang="ts">
// Run health: is the research engine working, and why do runs fail? Every
// run as one bar (tokens, outcome), the rolling success rate, failures by
// kind, what recent runs shipped (as item icons), then the full run table.
import { Badge } from '@fisherrjd/ui/badge'
import { Button } from '@fisherrjd/ui/button'
import { PageHeader } from '@fisherrjd/ui/layout'
import { ErrorState } from '@fisherrjd/ui/states'
import { Switch } from '@fisherrjd/ui/switch'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@fisherrjd/ui/table'
import { PlayIcon } from '@lucide/vue'
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { toast } from 'vue-sonner'
import ItemIcon from '@/components/ItemIcon.vue'
import LineChart from '@/components/LineChart.vue'
import RunBars from '@/components/RunBars.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import { api, duration, timeAgo, tokens, type Run } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import { median, OUTCOME, runOutcome } from '@/lib/runs'
import { FAIL_KIND_LABEL } from '@/lib/strategy'

const router = useRouter()
const runs = ref<Run[]>([]) // newest first, as the API returns them
const loading = ref(true)
const error = ref<string | null>(null)
// most cron runs legitimately ship nothing; the table hides them by default
// (failures always show)
const shippedOnly = ref(true)

const oldestFirst = computed(() => [...runs.value].reverse())
const counts = computed(() => {
  const c = { shipped: 0, empty: 0, failed: 0, running: 0 }
  for (const r of runs.value) c[runOutcome(r)]++
  return c
})
const span = computed(() => {
  const o = oldestFirst.value
  if (!o.length) return ''
  const f = (iso: string) => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
  return `${f(o[0].started_at)} to ${f(o[o.length - 1].started_at)}`
})
const finished = computed(() => runs.value.filter((r) => r.input_tokens != null))
const medTokens = computed(() => median(finished.value.map((r) => r.input_tokens! + (r.output_tokens ?? 0))))
const medCalls = computed(() => median(finished.value.map((r) => r.tool_calls ?? 0)))
const medMinutes = computed(() =>
  median(runs.value.filter((r) => r.finished_at).map((r) => (Date.parse(r.finished_at!) - Date.parse(r.started_at)) / 60_000)),
)

// share of the last 10 runs that did not fail, at each run
const rolling = computed(() => {
  const o = oldestFirst.value
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

const triggerLabel: Record<string, string> = { schedule: 'timer', signal: 'signal', empty: 'empty book', manual: 'manual' }

async function fetchAll() {
  runs.value = await api.runs(100)
}
const { updatedAt, refreshError, markUpdated } = useAutoRefresh(fetchAll)

onMounted(async () => {
  try {
    await fetchAll()
    markUpdated()
  } catch (e) {
    error.value = String(e)
  } finally {
    loading.value = false
  }
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
    <PageHeader title="Run health" :description="`Is the research engine working, and why do runs fail? Last ${runs.length} runs${span ? `, ${span}` : ''}.`">
      <template #actions>
        <UpdatedAgo :updated-at="updatedAt" :error="refreshError" />
        <Button size="sm" @click="trigger"><PlayIcon /> Trigger run</Button>
      </template>
    </PageHeader>

    <ErrorState v-if="error" title="Runs unavailable" :description="error" />
    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Shipped" :value="String(counts.shipped)" hint="ran clean, shipped at least one" />
        <StatTile label="Shipped nothing" :value="String(counts.empty)" hint="ran clean, nothing cleared the bar" />
        <StatTile
          label="Failed"
          :value="String(counts.failed)"
          :hint="failures.slice(0, 3).map((f) => `${f.n} ${f.label}`).join(' · ') || 'none'"
        />
        <StatTile
          label="Median tokens"
          :value="tokens(medTokens)"
          :hint="`typical run ~${medMinutes !== null ? Math.round(medMinutes) : '—'} min, ~${medCalls ?? '—'} tool calls`"
        />
      </div>

      <section class="space-y-2 rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-sm font-medium">Every run: tokens spent, colored by outcome</h2>
          <div class="flex flex-wrap gap-3 text-xs text-muted-foreground">
            <span v-for="k in (['shipped', 'empty', 'failed'] as const)" :key="k" class="inline-flex items-center gap-1.5">
              <span class="size-2.5 rounded-[1px]" :style="{ background: OUTCOME[k].color }" />{{ OUTCOME[k].label }}
            </span>
          </div>
        </div>
        <RunBars :runs="oldestFirst" />
        <div class="flex justify-between pl-11 font-mono text-[10px] text-muted-foreground"><span>oldest</span><span>newest · click a bar to open the run</span></div>
      </section>

      <div class="grid gap-4 lg:grid-cols-2">
        <section class="space-y-2 rounded-md border bg-card p-4">
          <div class="flex flex-wrap items-baseline justify-between gap-2">
            <h2 class="text-sm font-medium">Success rate, rolling 10 runs</h2>
            <span v-if="rolling.length" class="text-xs text-muted-foreground">
              last 10: <strong class="font-mono text-foreground">{{ rolling.at(-1)!.v }}%</strong> · worst stretch
              {{ Math.min(...rolling.map((p) => p.v ?? 100)) }}%
            </span>
          </div>
          <LineChart
            v-if="rolling.length"
            :points="rolling"
            :height="220"
            :width="520"
            :format="(v: number) => `${Math.round(v)}%`"
            label="Share of the last 10 runs that did not fail, at each run"
          />
          <p v-else class="text-sm text-muted-foreground">Needs at least 10 runs.</p>
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

      <section v-if="recentShips.length" class="space-y-2 rounded-md border bg-card p-4">
        <h2 class="text-sm font-medium">Recent runs, what they shipped</h2>
        <ol>
          <li v-for="r in recentShips" :key="r.run_id" class="flex items-center gap-4 border-b py-3 last:border-b-0">
            <RouterLink :to="`/runs/${r.run_id}`" class="w-28 shrink-0 font-mono text-sm hover:underline">
              #{{ r.run_id }}
              <span class="block text-[11px] text-muted-foreground">{{ timeAgo(r.started_at) }}</span>
            </RouterLink>
            <div class="flex flex-wrap gap-2">
              <RouterLink
                v-for="sh in r.shipped"
                :key="sh.strategy_id"
                :to="`/book/${sh.strategy_id}`"
                class="inline-flex items-center gap-2 border bg-muted/30 py-1 pr-3 pl-1 hover:border-primary"
              >
                <ItemIcon :icon="sh.icon" />
                <span class="flex flex-col">
                  <span class="text-sm">{{ sh.primary_item_name ?? sh.title }}</span>
                  <span class="font-mono text-[11px] text-muted-foreground">{{ sh.archetype }} #{{ sh.strategy_id }} · {{ sh.state }}</span>
                </span>
              </RouterLink>
            </div>
          </li>
        </ol>
      </section>

      <section class="space-y-2">
        <div class="flex flex-wrap items-center justify-between gap-2">
          <h2 class="text-sm font-medium">All runs</h2>
          <label class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
            <Switch v-model="shippedOnly" /> Hide empty runs
          </label>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-20">Run</TableHead>
              <TableHead>Status</TableHead>
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
            <TableRow v-for="r in visible" :key="r.run_id" class="cursor-pointer" @click="router.push(`/runs/${r.run_id}`)">
              <TableCell class="font-medium tabular-nums">
                <RouterLink :to="`/runs/${r.run_id}`" @click.stop>#{{ r.run_id }}</RouterLink>
              </TableCell>
              <TableCell><StatusBadge :state="r.status" /></TableCell>
              <TableCell class="text-xs text-muted-foreground">{{ r.trigger_source ? triggerLabel[r.trigger_source] : '—' }}</TableCell>
              <TableCell class="text-muted-foreground">{{ timeAgo(r.started_at) }}</TableCell>
              <TableCell class="text-right text-muted-foreground tabular-nums">{{ duration(r.started_at, r.finished_at) }}</TableCell>
              <TableCell class="text-right text-muted-foreground tabular-nums">{{ r.tool_calls ?? '—' }}</TableCell>
              <TableCell class="text-right text-muted-foreground tabular-nums">
                {{ r.input_tokens != null ? tokens((r.input_tokens ?? 0) + (r.output_tokens ?? 0)) : '—' }}
              </TableCell>
              <TableCell class="text-right tabular-nums">{{ r.n_strategies }}</TableCell>
              <TableCell class="max-w-md text-xs text-muted-foreground" :title="r.fail_reason ?? ''">
                <template v-if="r.status === 'failed'">
                  <Badge v-if="r.fail_kind" variant="outline" class="mr-1">{{ FAIL_KIND_LABEL[r.fail_kind] ?? r.fail_kind }}</Badge>
                  <span class="truncate">{{ r.fail_kind ? r.fail_detail : r.fail_reason }}</span>
                </template>
              </TableCell>
            </TableRow>
            <TableRow v-if="!loading && visible.length === 0">
              <TableCell colspan="9" class="text-center text-muted-foreground">no runs yet</TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </section>
    </template>
  </div>
</template>
