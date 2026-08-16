<script setup lang="ts">
import { PlayIcon, RefreshCwIcon } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, duration, timeAgo, tokens, type Run } from '@/lib/api'

const router = useRouter()
const runs = ref<Run[]>([])
const loading = ref(true)
// most cron runs legitimately ship nothing — default to hiding them (an
// "empty" run succeeded and shipped zero strategies; failures always show)
const shippedOnly = ref(true)
const visible = computed(() =>
  shippedOnly.value
    ? runs.value.filter((r) => r.n_strategies > 0 || r.status !== 'succeeded')
    : runs.value,
)
const hiddenCount = computed(() => runs.value.length - visible.value.length)
// Burn across the fetched window — hidden runs burn tokens too, so the
// totals always cover ALL fetched runs, not just the visible ones.
const totalTokens = computed(() =>
  runs.value.reduce((sum, r) => sum + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0),
)

const triggerLabel: Record<string, string> = {
  schedule: 'timer',
  signal: 'signal',
  empty: 'empty book',
  manual: 'manual',
}

async function load() {
  try {
    runs.value = await api.runs(50)
  } catch (e) {
    toast.error(String(e))
  } finally {
    loading.value = false
  }
}

async function trigger() {
  try {
    const { run_id } = await api.triggerRun()
    toast.success(`run ${run_id} started`)
    router.push(`/runs/${run_id}`)
  } catch (e) {
    toast.error(String(e))
  }
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  load()
  timer = setInterval(load, 30_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Runs" description="Every research cycle: what the agent saw, shipped and dismissed.">
      <template #actions>
        <label class="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <Switch v-model="shippedOnly" />
          Hide empty runs
        </label>
        <Button variant="outline" size="sm" @click="load"><RefreshCwIcon /> Refresh</Button>
        <Button size="sm" @click="trigger"><PlayIcon /> Trigger run</Button>
      </template>
    </PageHeader>

    <p class="text-xs text-muted-foreground tabular-nums">
      showing {{ visible.length }} of {{ runs.length }} runs{{ shippedOnly && hiddenCount ? ` — ${hiddenCount} empty hidden` : '' }}
      <template v-if="totalTokens > 0"> · {{ tokens(totalTokens) }} tokens across all {{ runs.length }}</template>
    </p>

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
        <TableRow
          v-for="r in visible"
          :key="r.run_id"
          class="cursor-pointer"
          @click="router.push(`/runs/${r.run_id}`)"
        >
          <TableCell class="font-medium tabular-nums">#{{ r.run_id }}</TableCell>
          <TableCell><StatusBadge :state="r.status" /></TableCell>
          <TableCell class="text-xs text-muted-foreground">
            {{ r.trigger_source ? triggerLabel[r.trigger_source] : '—' }}
          </TableCell>
          <TableCell class="text-muted-foreground">{{ timeAgo(r.started_at) }}</TableCell>
          <TableCell class="text-right tabular-nums text-muted-foreground">{{ duration(r.started_at, r.finished_at) }}</TableCell>
          <TableCell class="text-right tabular-nums text-muted-foreground">{{ r.tool_calls ?? '—' }}</TableCell>
          <TableCell
            class="text-right tabular-nums text-muted-foreground"
            :title="r.input_tokens != null ? `${r.input_tokens.toLocaleString()} in / ${r.output_tokens?.toLocaleString()} out` : 'no cost record'"
          >
            {{ r.input_tokens != null ? tokens((r.input_tokens ?? 0) + (r.output_tokens ?? 0)) : '—' }}
          </TableCell>
          <TableCell class="text-right tabular-nums">{{ r.n_strategies }}</TableCell>
          <TableCell class="max-w-md truncate text-xs text-muted-foreground">
            {{ r.fail_reason ?? '' }}
          </TableCell>
        </TableRow>
        <TableRow v-if="!loading && visible.length === 0">
          <TableCell colspan="9" class="text-center text-muted-foreground">
            {{ runs.length ? `all ${runs.length} recent runs shipped nothing (a valid outcome — see their Discarded sections)` : 'no runs yet' }}
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
