<script setup lang="ts">
import { ActivityIcon, ArrowRightIcon } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import DailyPnlChart from '@/components/DailyPnlChart.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatTile from '@/components/StatTile.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { api, gp, timeAgo, type Health, type PnLResponse, type Signal, type Strategy } from '@/lib/api'

const pnl = ref<PnLResponse | null>(null)
const book = ref<Strategy[]>([])
const signals = ref<Signal[]>([])
const health = ref<Health | null>(null)

const committed = computed(() => book.value.reduce((s, x) => s + (x.capital_required ?? 0), 0))

const realized7d = computed(() => {
  const cutoff = Date.now() - 7 * 86400_000
  return (pnl.value?.strategies ?? [])
    .filter((r) => r.closed_at && new Date(r.closed_at).getTime() >= cutoff)
    .reduce((s, r) => s + (r.est_realized_gp ?? 0), 0)
})

const days = computed(() => {
  const by = new Map<string, { gp: number; n: number }>()
  const cutoff = Date.now() - 14 * 86400_000
  for (const r of pnl.value?.strategies ?? []) {
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

// strategy-centric activity: the loop's PRODUCT, not its exhaust
const recentShips = computed(() =>
  [...(pnl.value?.strategies ?? [])]
    .sort((a, b) => b.opened_at.localeCompare(a.opened_at))
    .slice(0, 6),
)
const recentCloses = computed(() =>
  (pnl.value?.strategies ?? [])
    .filter((r) => r.closed_at)
    .sort((a, b) => b.closed_at!.localeCompare(a.closed_at!))
    .slice(0, 6),
)

const comboQueued = computed(
  () => signals.value.filter((s) => s.kind === 'combo' && s.status === 'pending').length,
)
const pendingTotal = computed(() => signals.value.filter((s) => s.status === 'pending').length)

async function load() {
  try {
    ;[pnl.value, book.value, signals.value, health.value] = await Promise.all([
      api.pnl(),
      api.openBook(),
      api.signals(200),
      api.health(),
    ])
  } catch (e) {
    toast.error(String(e))
  }
}

let timer: ReturnType<typeof setInterval>
onMounted(() => {
  load()
  timer = setInterval(load, 60_000)
})
onUnmounted(() => clearInterval(timer))
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Overview" description="What the engine holds, what it just did, and what it queued next.">
      <template #actions>
        <Button v-if="health?.active_run_id" variant="outline" size="sm" as-child>
          <RouterLink :to="`/runs/${health.active_run_id}`">
            <ActivityIcon class="animate-pulse" /> run #{{ health.active_run_id }} live
          </RouterLink>
        </Button>
      </template>
    </PageHeader>

    <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <StatTile label="Open book" :value="String(book.length)" :hint="`${gp(committed)} gp committed`" />
      <StatTile label="Realized, 7d (est.)" :value="`${gp(realized7d)} gp`" :signed="realized7d" hint="paper, haircut" />
      <StatTile label="Signal queue" :value="String(pendingTotal)" :hint="`${comboQueued} combo (C lane)`" />
      <StatTile
        label="Engine"
        :value="health?.active_run_id ? 'researching' : health?.ok ? 'idle' : 'unhealthy'"
        :hint="health?.active_run_id ? `run #${health.active_run_id}` : 'waiting on schedule/signals'"
      />
    </div>

    <section>
      <h2 class="mb-2 text-sm font-medium">Daily realized, 14d</h2>
      <DailyPnlChart :days="days" />
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <section>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium">Latest ships</h2>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink to="/book">book <ArrowRightIcon /></RouterLink>
          </Button>
        </div>
        <ul class="space-y-1.5">
          <li v-for="r in recentShips" :key="r.strategy_id" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <Badge variant="outline" class="font-mono">{{ r.archetype }}</Badge>
            <span class="min-w-0 flex-1 truncate">{{ r.title }}</span>
            <StatusBadge :state="r.state" />
            <span class="text-xs text-muted-foreground">{{ timeAgo(r.opened_at) }}</span>
          </li>
          <li v-if="recentShips.length === 0" class="text-sm text-muted-foreground">nothing shipped yet</li>
        </ul>
      </section>

      <section>
        <div class="mb-2 flex items-center justify-between">
          <h2 class="text-sm font-medium">Latest closes</h2>
          <Button variant="ghost" size="sm" as-child>
            <RouterLink to="/pnl">p&l <ArrowRightIcon /></RouterLink>
          </Button>
        </div>
        <ul class="space-y-1.5">
          <li v-for="r in recentCloses" :key="r.strategy_id" class="flex items-center gap-2 rounded-md border px-3 py-2 text-sm">
            <StatusBadge :state="r.state" />
            <span class="min-w-0 flex-1 truncate">{{ r.title }}</span>
            <span class="font-medium tabular-nums" :class="(r.est_realized_gp ?? 0) < 0 ? 'text-destructive' : ''">
              {{ gp(r.est_realized_gp) }}
            </span>
            <span class="text-xs text-muted-foreground">{{ timeAgo(r.closed_at) }}</span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
