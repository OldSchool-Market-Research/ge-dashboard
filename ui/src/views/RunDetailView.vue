<script setup lang="ts">
import { Button } from '@fisherrjd/ui/button'
import { PageHeader } from '@fisherrjd/ui/layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fisherrjd/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@fisherrjd/ui/tabs'
import { ArrowLeftIcon } from '@lucide/vue'
import DOMPurify from 'dompurify'
import { marked } from 'marked'
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import StrategyCard from '@/components/StrategyCard.vue'
import { api, duration, timeAgo, tokens, type Run, type RunStats, type Strategy } from '@/lib/api'
import { useRunStream } from '@/lib/runStream'
import { STATE_INFO } from '@/lib/status'
import { FAIL_KIND_LABEL } from '@/lib/strategy'

const route = useRoute()
const id = route.params.id as string

const run = ref<Run | null>(null)
const strategies = ref<Strategy[]>([])
const reportHtml = ref('')
const stats = ref<RunStats | null>(null)

const liveId = computed(() => (run.value?.status === 'running' ? run.value.run_id : null))
const stream = useRunStream(liveId, () => load())

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
}

onMounted(load)
</script>

<template>
  <div v-if="run" class="space-y-5">
    <PageHeader
      :title="`Run #${run.run_id}`"
      :description="`started ${timeAgo(run.started_at)}${run.mode ? ` · ${run.mode}` : ''}${run.trigger_source ? ` · ${triggerLabel[run.trigger_source]}` : ''}`"
    >
      <template #actions>
        <StatusBadge :state="run.status" />
        <Button variant="outline" size="sm" as-child>
          <RouterLink to="/runs"><ArrowLeftIcon /> All runs</RouterLink>
        </Button>
      </template>
    </PageHeader>

    <p class="text-sm text-muted-foreground">{{ STATE_INFO[run.status]?.meaning }}</p>

    <div v-if="run.fail_reason" class="space-y-1 rounded-md border p-3">
      <p v-if="run.fail_kind" class="text-sm font-medium">
        {{ FAIL_KIND_LABEL[run.fail_kind] ?? run.fail_kind }}<template v-if="run.fail_detail">: {{ run.fail_detail }}</template>
      </p>
      <p class="font-mono text-xs text-muted-foreground">{{ run.fail_reason }}</p>
    </div>

    <div v-if="run.input_tokens != null" class="grid grid-cols-2 gap-3 md:grid-cols-4">
      <StatTile label="tokens in / out" :value="`${tokens(run.input_tokens)} / ${tokens(run.output_tokens)}`" :hint="`peak context ${tokens(run.peak_input_tokens)}`" />
      <StatTile label="turns" :value="String(run.turns ?? '—')" />
      <StatTile label="tool calls" :value="String(run.tool_calls ?? '—')" />
      <StatTile label="took" :value="duration(run.started_at, run.finished_at)" :hint="run.pruned_bytes ? `${tokens(run.pruned_bytes)}B of old results pruned` : undefined" />
    </div>

    <div v-if="run.status === 'running'" class="mb-6 rounded-md border bg-muted/30 p-3">
      <div class="mb-1 text-xs font-medium text-muted-foreground">
        live · turn {{ stream.turns.value }} · {{ stream.toolCalls.value }} tool calls<template v-if="stream.rejections.value"> · {{ stream.rejections.value }} report rejection{{ stream.rejections.value === 1 ? '' : 's' }}</template>
      </div>
      <pre class="max-h-64 overflow-y-auto font-mono text-xs whitespace-pre-wrap">{{ stream.lines.value.join('\n') || 'waiting for events…' }}</pre>
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
          class="md-prose max-w-none [&_table]:block [&_table]:overflow-x-auto"
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
