<script setup lang="ts">
// Strategy board: every open strategy as a card (legs as icons, live margin
// trail, health split, checks in words), with the book's totals and which
// checks drag it down. Live, refreshed every minute.
import { Button } from '@fisherrjd/ui/button'
import { PageHeader } from '@fisherrjd/ui/layout'
import { EmptyState, ErrorState } from '@fisherrjd/ui/states'
import { computed, onMounted, ref } from 'vue'
import BookCard from '@/components/BookCard.vue'
import StatTile from '@/components/StatTile.vue'
import UpdatedAgo from '@/components/UpdatedAgo.vue'
import { api, gp, type CalibrationRow, type Strategy } from '@/lib/api'
import { useAutoRefresh } from '@/lib/autoRefresh'
import { checkLabel, checkLines, latestEval, projectedPerHour, shortName } from '@/lib/strategy'

const book = ref<Strategy[]>([])
const calibration = ref<CalibrationRow[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

type SortKey = 'capital' | 'gph' | 'newest'
const sortKey = ref<SortKey>('capital')
const sortLabels: Record<SortKey, string> = { capital: 'Capital', gph: 'gp/hr', newest: 'Newest' }

const sorted = computed(() =>
  [...book.value].sort((a, b) => {
    if (sortKey.value === 'capital') return (b.capital_required ?? 0) - (a.capital_required ?? 0)
    if (sortKey.value === 'gph') return (projectedPerHour(b) ?? 0) - (projectedPerHour(a) ?? 0)
    return b.opened_at.localeCompare(a.opened_at)
  }),
)

const committed = computed(() => book.value.reduce((s, x) => s + (x.capital_required ?? 0), 0))
const largest = computed(() => [...book.value].sort((a, b) => (b.capital_required ?? 0) - (a.capital_required ?? 0))[0])
const lanes = computed(() => {
  const by = new Map<string, number>()
  for (const s of book.value) by.set(s.archetype, (by.get(s.archetype) ?? 0) + 1)
  return [...by.entries()].map(([a, n]) => `${a} ${n}`).join(' · ')
})
const projected = computed(() => book.value.reduce((s, x) => s + (projectedPerHour(x) ?? 0), 0))
// projected pace scaled by each lane's calibration factor (realized/projected)
const calibrated = computed(() => {
  const factor = new Map(calibration.value.map((c) => [c.archetype, c.factor]))
  let sum = 0
  for (const s of book.value) {
    const f = factor.get(s.archetype)
    if (f == null) return null
    sum += (projectedPerHour(s) ?? 0) * f
  }
  return sum
})
const verdicts = computed(() => {
  const n = { healthy: 0, degraded: 0, kill_signal: 0 }
  for (const s of book.value) {
    const v = (s.live_verdict ?? latestEval(s)?.verdict) as keyof typeof n | undefined
    if (v && v in n) n[v]++
  }
  return n
})

// each check across the book: how many strategies pass it
const checkSummary = computed(() => {
  const by = new Map<string, { pass: number; total: number }>()
  for (const s of book.value) {
    for (const c of checkLines(s.live_checks ?? latestEval(s)?.checks)) {
      const cur = by.get(c.key) ?? { pass: 0, total: 0 }
      cur.total++
      if (c.ok) cur.pass++
      by.set(c.key, cur)
    }
  }
  return [...by.entries()].map(([key, v]) => ({ key, label: checkLabel(key), ...v })).sort((a, b) => a.pass / a.total - b.pass / b.total)
})
const failingEverywhere = computed(() => checkSummary.value.filter((c) => c.pass === 0 && c.total === book.value.length))

async function fetchAll() {
  const [b, cal] = await Promise.all([api.openBook(), api.calibration(30).catch(() => null)])
  book.value = b
  if (cal) calibration.value = cal.latest
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
</script>

<template>
  <div class="space-y-6">
    <PageHeader title="Strategy board" description="What the paper trader holds right now, and whether each one is working.">
      <template #actions>
        <UpdatedAgo :updated-at="updatedAt" :error="refreshError" />
      </template>
    </PageHeader>

    <ErrorState v-if="error" title="Book unavailable" :description="error" />
    <template v-else>
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Open" :value="String(book.length)" :hint="lanes || 'nothing open'" />
        <StatTile
          label="Capital committed"
          :value="gp(committed)"
          :hint="largest ? `largest: ${shortName(largest)} at ${gp(largest.capital_required)}` : undefined"
        />
        <StatTile
          label="Projected pace"
          :value="`${gp(projected)}/hr`"
          :hint="calibrated !== null ? `≈ ${gp(calibrated)}/hr after calibration` : 'no calibration yet'"
        />
        <StatTile
          label="Health now"
          :value="`${verdicts.degraded} degraded`"
          :hint="`${verdicts.healthy} healthy · ${verdicts.kill_signal} kill signal`"
        />
      </div>

      <section v-if="checkSummary.length" class="space-y-3 rounded-md border bg-card p-4">
        <div class="flex flex-wrap items-baseline justify-between gap-2">
          <h2 class="text-sm font-medium">Checks across the book</h2>
          <p v-if="failingEverywhere.length" class="text-sm text-muted-foreground">
            {{ failingEverywhere.map((c) => `"${c.label}"`).join(', ') }} {{ failingEverywhere.length > 1 ? 'fail' : 'fails' }} on all {{ book.length }} open strategies.
          </p>
        </div>
        <div class="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
          <div v-for="c in checkSummary" :key="c.key" class="space-y-1">
            <div class="flex justify-between gap-2 text-sm">
              <span class="truncate">{{ c.label }}</span>
              <span class="font-mono text-muted-foreground tabular-nums">{{ c.pass }} / {{ c.total }}</span>
            </div>
            <div class="h-2 bg-destructive/25" role="img" :aria-label="`${c.label}: ${c.pass} of ${c.total} pass`">
              <div class="h-full bg-success" :style="{ width: `${(c.pass / c.total) * 100}%` }" />
            </div>
          </div>
        </div>
      </section>

      <div class="flex flex-wrap items-center gap-1" role="group" aria-label="Sort strategies">
        <span class="mr-1 font-mono text-xs text-muted-foreground uppercase">Sort</span>
        <Button
          v-for="(label, key) in sortLabels"
          :key="key"
          :variant="sortKey === key ? 'secondary' : 'ghost'"
          size="sm"
          :aria-pressed="sortKey === key"
          @click="sortKey = key"
        >
          {{ label }}
        </Button>
      </div>

      <div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <BookCard v-for="s in sorted" :key="s.strategy_id" :strategy="s" />
      </div>
      <EmptyState
        v-if="!loading && book.length === 0"
        title="Nothing open"
        description="The book is empty. The next run fills free slots."
      />
    </template>
  </div>
</template>
