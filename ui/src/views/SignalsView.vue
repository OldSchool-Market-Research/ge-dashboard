<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, gp, timeAgo, type Signal, type WatchRow } from '@/lib/api'

const signals = ref<Signal[]>([])
const watchlist = ref<WatchRow[]>([])

// combo candidates get their budget-sized number surfaced — the number the
// lane is ranked by, so review needs no metrics spelunking
function signalSummary(s: Signal): string {
  const m = s.metrics
  if (s.kind === 'combo')
    return `${m.relation ?? `relation ${m.relation_id}`} ${m.direction ?? ''} · ${gp(Number(m.budget_cycle_gp ?? 0))} gp/4h`
  if (m.gp_cycle) return `${gp(Number(m.gp_cycle))} gp/cycle`
  if (m.z) return `z=${Number(m.z).toFixed(1)}`
  return ''
}

const queue = computed(() => signals.value.filter((s) => s.status === 'pending' || s.status === 'assigned'))
const resolved = computed(() => signals.value.filter((s) => s.status === 'dismissed' || s.status === 'investigated').slice(0, 20))

onMounted(async () => {
  try {
    ;[signals.value, watchlist.value] = await Promise.all([api.signals(100), api.watchlist()])
  } catch (e) {
    toast.error(String(e))
  }
})
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Signals" description="The collector's work queue — what the next runs will be assigned." />

    <section>
      <h2 class="mb-2 text-sm font-medium">Queue ({{ queue.length }})</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Kind</TableHead>
            <TableHead>Item</TableHead>
            <TableHead>Signal</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Age</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="s in queue" :key="s.signal_id">
            <TableCell>
              <Badge :variant="s.kind === 'combo' ? 'default' : 'outline'" class="font-mono">{{ s.kind }}</Badge>
            </TableCell>
            <TableCell class="font-medium">{{ s.item_name }}</TableCell>
            <TableCell class="tabular-nums text-muted-foreground">{{ signalSummary(s) }}</TableCell>
            <TableCell><StatusBadge :state="s.status === 'assigned' ? 'running' : 'armed'" /></TableCell>
            <TableCell class="text-muted-foreground">{{ timeAgo(s.created_at) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>

    <section v-if="watchlist.length">
      <h2 class="mb-2 text-sm font-medium">Watch portfolio</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Item</TableHead>
            <TableHead>Lane</TableHead>
            <TableHead class="text-right">Score</TableHead>
            <TableHead class="text-right">Validated / confirmed</TableHead>
            <TableHead>Last result</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="w in watchlist" :key="w.watch_id">
            <TableCell class="font-medium">{{ w.item_name }}</TableCell>
            <TableCell class="font-mono">{{ w.archetype }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ w.score.toFixed(1) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ w.times_validated }} / {{ w.times_confirmed }}</TableCell>
            <TableCell class="text-muted-foreground">{{ w.last_result ?? '—' }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>

    <section v-if="resolved.length">
      <h2 class="mb-2 text-sm font-medium">Recently resolved</h2>
      <ul class="space-y-1.5">
        <li v-for="s in resolved" :key="s.signal_id" class="rounded-md border px-3 py-2 text-sm">
          <span class="font-mono text-xs text-muted-foreground">[{{ s.kind }}]</span>
          <span class="mx-1.5 font-medium">{{ s.item_name }}</span>
          <span class="text-xs text-muted-foreground">{{ s.status }}{{ s.reason ? ` — ${s.reason}` : '' }}</span>
        </li>
      </ul>
    </section>
  </div>
</template>
