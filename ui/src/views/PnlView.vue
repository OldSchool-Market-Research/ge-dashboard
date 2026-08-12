<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import DailyPnlChart from '@/components/DailyPnlChart.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, gp, type PnLResponse } from '@/lib/api'

const pnl = ref<PnLResponse | null>(null)
const showAll = ref(false)
const window = ref<14 | 30 | 90>(14)

const total = computed(() =>
  Object.values(pnl.value?.by_state ?? {}).reduce((s, b) => s + b.est_realized_gp, 0),
)

// client-side daily aggregation of closed strategies, windowed
const days = computed(() => {
  if (!pnl.value) return []
  const by = new Map<string, { gp: number; n: number }>()
  const cutoff = Date.now() - window.value * 86400_000
  for (const r of pnl.value.strategies) {
    if (!r.closed_at || r.est_realized_gp === null) continue
    if (new Date(r.closed_at).getTime() < cutoff) continue
    const day = r.closed_at.slice(0, 10)
    const cur = by.get(day) ?? { gp: 0, n: 0 }
    cur.gp += r.est_realized_gp
    cur.n += 1
    by.set(day, cur)
  }
  return [...by.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([day, v]) => ({ day, ...v }))
})

const rows = computed(() => {
  const all = [...(pnl.value?.strategies ?? [])].sort(
    (a, b) => Math.abs(b.est_realized_gp ?? 0) - Math.abs(a.est_realized_gp ?? 0),
  )
  return showAll.value ? all : all.slice(0, 25)
})

onMounted(async () => {
  try {
    pnl.value = await api.pnl()
  } catch (e) {
    toast.error(String(e))
  }
})
</script>

<template>
  <div v-if="pnl" class="space-y-6">
    <PageHeader title="P&L" description="Paper estimates with the self-impact haircut — an upper bound, not a ledger." />

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile label="Est. realized (all time)" :value="`${gp(total)} gp`" :signed="total" />
      <StatTile
        v-for="a in ['F', 'C', 'B']"
        :key="a"
        :label="`${a} lane`"
        :value="`${gp(pnl.by_archetype[a]?.est_realized_gp ?? 0)} gp`"
        :signed="pnl.by_archetype[a]?.est_realized_gp ?? 0"
        :hint="`${pnl.by_archetype[a]?.n ?? 0} strategies`"
      />
    </div>

    <section>
      <div class="mb-2 flex items-center justify-between">
        <h2 class="text-sm font-medium">Daily realized (est., closed strategies)</h2>
        <!-- filters in one row above the chart -->
        <div class="flex gap-1">
          <Button
            v-for="w in [14, 30, 90] as const"
            :key="w"
            :variant="window === w ? 'secondary' : 'ghost'"
            size="sm"
            @click="window = w"
          >
            {{ w }}d
          </Button>
        </div>
      </div>
      <DailyPnlChart :days="days" />
    </section>

    <section>
      <h2 class="mb-2 text-sm font-medium">Per strategy (largest effect first)</h2>
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
              <div class="truncate font-medium">{{ r.title }}</div>
              <div class="font-mono text-xs text-muted-foreground">
                {{ r.sid }}
                <Badge v-if="r.sim_scored" variant="outline" class="ml-1 text-[10px]">sim</Badge>
              </div>
            </TableCell>
            <TableCell><StatusBadge :state="r.state" /></TableCell>
            <TableCell class="text-right tabular-nums">{{ r.hours.toFixed(1) }}</TableCell>
            <TableCell class="text-right font-medium tabular-nums">{{ gp(r.est_realized_gp) }}</TableCell>
            <TableCell class="text-right tabular-nums text-muted-foreground">{{ gp(r.projected_gp) }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Button v-if="!showAll && (pnl.strategies.length > 25)" variant="ghost" size="sm" class="mt-2" @click="showAll = true">
        show all {{ pnl.strategies.length }}
      </Button>
    </section>
  </div>
</template>
