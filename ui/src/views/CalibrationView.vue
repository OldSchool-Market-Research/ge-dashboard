<script setup lang="ts">
import { PageHeader } from '@fisherrjd/ui/layout'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@fisherrjd/ui/table'
import { computed, onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import CalibrationChart from '@/components/CalibrationChart.vue'
import StatTile from '@/components/StatTile.vue'
import { api, type CalibrationResponse } from '@/lib/api'

const cal = ref<CalibrationResponse | null>(null)
const error = ref('')

// lanes and kinds get a tile; families are many and mostly thin, so they get a
// table, and only once one has a measure
const KINDS = new Set(['set', 'combine', 'decant'])
const isFamily = (key: string) => key.includes(':') && !KINDS.has(key.split(':')[1])
const tiles = computed(() => (cal.value?.latest ?? []).filter((r) => !isFamily(r.archetype)))
const families = computed(() =>
  (cal.value?.latest ?? []).filter((r) => isFamily(r.archetype) && (r.p_survive !== null || r.pace_ratio !== null)),
)

onMounted(async () => {
  try {
    cal.value = await api.calibration(30)
  } catch (e) {
    error.value = String(e)
    toast.error(String(e))
  }
})
</script>

<template>
  <div v-if="error" class="rounded-md border border-destructive/40 p-4 text-sm">
    <p class="font-medium text-destructive">calibration API unavailable</p>
    <p class="mt-1 font-mono text-xs text-muted-foreground">{{ error }}</p>
  </div>
  <div v-else-if="cal" class="space-y-6">
    <PageHeader
      title="Calibration"
      description="What the record says a raw claim is worth: factor = p_survive × pace. The loop's learning curve."
    />

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        v-for="r in tiles"
        :key="r.archetype"
        :label="`${r.archetype} factor${r.epoch > 1 ? ` (epoch ${r.epoch})` : ''}`"
        :value="r.factor.toFixed(2)"
        :hint="
          r.p_survive !== null
            ? `p_survive ${(r.p_survive * 100).toFixed(0)}% · n=${r.n_closed}`
            : `below sample (n=${r.n_closed})`
        "
      />
    </div>

    <section v-if="families.length">
      <h2 class="mb-2 text-sm font-medium">Combine families with a measure</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Family</TableHead>
            <TableHead class="text-right">Factor</TableHead>
            <TableHead class="text-right">Alive at 6h</TableHead>
            <TableHead class="text-right">Closes</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="r in families" :key="r.archetype">
            <TableCell class="font-medium capitalize">{{ r.archetype.split(':')[1] }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ r.factor.toFixed(2) }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ r.p_survive === null ? '—' : `${(r.p_survive * 100).toFixed(0)}%` }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ r.n_closed }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>

    <section>
      <h2 class="mb-2 text-sm font-medium">Factor history (30d)</h2>
      <CalibrationChart :history="cal.history" />
    </section>

    <section>
      <h2 class="mb-2 text-sm font-medium">Failure modes (30d)</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Lane</TableHead>
            <TableHead>Mode</TableHead>
            <TableHead class="text-right">Count</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="m in cal.failure_modes" :key="`${m.archetype}-${m.mode}`">
            <TableCell class="font-mono">{{ m.archetype }}</TableCell>
            <TableCell>{{ m.mode }}</TableCell>
            <TableCell class="text-right tabular-nums">{{ m.n }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </section>
  </div>
</template>
