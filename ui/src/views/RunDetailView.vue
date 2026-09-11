<script setup lang="ts">
import { ArrowLeftIcon } from '@lucide/vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import StrategyCard from '@/components/StrategyCard.vue'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { api, duration, timeAgo, tokens, type Run, type RunStats, type Strategy } from '@/lib/api'

const route = useRoute()
const id = route.params.id as string

const run = ref<Run | null>(null)
const strategies = ref<Strategy[]>([])
const reportHtml = ref('')
const stats = ref<RunStats | null>(null)
const events = ref<string[]>([])
let es: EventSource | null = null

const shipped = computed(() => strategies.value.filter((s) => s.state !== 'vetoed'))
const vetoed = computed(() => strategies.value.filter((s) => s.state === 'vetoed'))

const triggerLabel: Record<string, string> = {
  schedule: 'timer',
  signal: 'signal-triggered',
  empty: 'empty book',
  manual: 'manual',
}

async function load() {
  const { run: r, strategies: st } = await api.run(id)
  run.value = r
  strategies.value = st ?? []
  if (r.status === 'succeeded') {
    reportHtml.value = DOMPurify.sanitize(await marked.parse(await api.report(id)))
  }
  if (r.status !== 'running') {
    // Cost sidecar exists for agent >= 0.10.0 runs; 404 before that is fine.
    stats.value = await api.runStats(id).catch(() => null)
  }
  if (r.status === 'running' && !es) {
    es = new EventSource(`/api/runs/${id}/events`)
    es.onmessage = (e) => events.value.push(e.data)
    for (const t of ['started', 'agent_log', 'vetoed', 'ingested', 'finished']) {
      es.addEventListener(t, (e) => {
        events.value.push(`[${t}] ${(e as MessageEvent).data}`)
        if (t === 'finished') {
          es?.close()
          es = null
          load()
        }
      })
    }
  }
}

onMounted(load)
onUnmounted(() => es?.close())
</script>

<template>
  <div v-if="run" class="space-y-5">
    <PageHeader
      :title="`Run #${run.run_id}`"
      :description="`started ${timeAgo(run.started_at)}${run.trigger_source ? ` · ${triggerLabel[run.trigger_source]}` : ''}`"
    >
      <template #actions>
        <StatusBadge :state="run.status" />
        <Button variant="outline" size="sm" as-child>
          <RouterLink to="/"><ArrowLeftIcon /> All runs</RouterLink>
        </Button>
      </template>
    </PageHeader>

    <p v-if="run.fail_reason" class="mb-4 rounded-md border p-3 font-mono text-xs text-muted-foreground">
      {{ run.fail_reason }}
    </p>

    <div v-if="run.input_tokens != null" class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label="tokens in / out" :value="`${tokens(run.input_tokens)} / ${tokens(run.output_tokens)}`" :hint="`peak context ${tokens(run.peak_input_tokens)}`" />
      <StatTile label="turns" :value="String(run.turns ?? '—')" />
      <StatTile label="tool calls" :value="String(run.tool_calls ?? '—')" />
      <StatTile label="took" :value="duration(run.started_at, run.finished_at)" :hint="run.pruned_bytes ? `${tokens(run.pruned_bytes)}B of old results pruned` : undefined" />
    </div>

    <div v-if="run.status === 'running'" class="mb-6 rounded-md border bg-muted/30 p-3">
      <div class="mb-1 text-xs font-medium text-muted-foreground">live</div>
      <pre class="max-h-64 overflow-y-auto font-mono text-xs whitespace-pre-wrap">{{ events.join('\n') || 'waiting for events…' }}</pre>
    </div>

    <Tabs default-value="report">
      <TabsList>
        <TabsTrigger value="report">Report</TabsTrigger>
        <TabsTrigger value="shipped">Shipped ({{ shipped.length }})</TabsTrigger>
        <TabsTrigger value="vetoed">Vetoed ({{ vetoed.length }})</TabsTrigger>
        <TabsTrigger v-if="stats" value="cost">Cost</TabsTrigger>
      </TabsList>
      <TabsContent value="report">
        <article
          v-if="reportHtml"
          class="prose prose-sm dark:prose-invert max-w-none [&_table]:block [&_table]:overflow-x-auto"
          v-html="reportHtml"
        />
        <p v-else class="text-sm text-muted-foreground">no report (run {{ run.status }})</p>
      </TabsContent>
      <TabsContent value="shipped">
        <div class="grid gap-3 md:grid-cols-2">
          <StrategyCard v-for="s in shipped" :key="s.strategy_id" :strategy="s" />
        </div>
        <p v-if="shipped.length === 0" class="text-sm text-muted-foreground">nothing shipped — check the report's Discarded section</p>
      </TabsContent>
      <TabsContent value="vetoed">
        <ul class="space-y-2">
          <li v-for="s in vetoed" :key="s.strategy_id" class="rounded-md border p-3">
            <div class="flex items-center justify-between gap-2">
              <span class="font-medium">{{ s.sid }}</span>
              <StatusBadge state="vetoed" />
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{{ s.state_reason }}</p>
          </li>
        </ul>
        <p v-if="vetoed.length === 0" class="text-sm text-muted-foreground">no vetoes</p>
      </TabsContent>
      <TabsContent v-if="stats" value="cost">
        <p class="mb-3 text-xs text-muted-foreground">
          Per-turn spend as billed. "In" is the whole context resent that turn — watch it grow;
          a flat tail means pruning is holding the line.
        </p>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead class="w-16">Turn</TableHead>
              <TableHead class="text-right">In</TableHead>
              <TableHead class="text-right">Out</TableHead>
              <TableHead class="text-right">Tool calls</TableHead>
              <TableHead>Context</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow v-for="t in stats.per_turn" :key="t.turn">
              <TableCell class="tabular-nums">{{ t.turn }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ tokens(t.input_tokens) }}</TableCell>
              <TableCell class="text-right tabular-nums">{{ tokens(t.output_tokens) }}</TableCell>
              <TableCell class="text-right tabular-nums text-muted-foreground">{{ t.tool_calls }}</TableCell>
              <TableCell>
                <div class="h-1.5 max-w-48 rounded-full bg-muted">
                  <div
                    class="h-full rounded-full bg-primary/60"
                    :style="{ width: `${Math.round((t.input_tokens / stats.peak_input_tokens) * 100)}%` }"
                  />
                </div>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </TabsContent>
    </Tabs>
  </div>
</template>
