<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import CalibrationChart from '@/components/CalibrationChart.vue'
import PageHeader from '@/components/PageHeader.vue'
import StatTile from '@/components/StatTile.vue'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, type CalibrationResponse } from '@/lib/api'

const cal = ref<CalibrationResponse | null>(null)

onMounted(async () => {
  try {
    cal.value = await api.calibration(30)
  } catch (e) {
    toast.error(String(e))
  }
})
</script>

<template>
  <div v-if="cal" class="space-y-6">
    <PageHeader
      title="Calibration"
      description="What the record says a raw claim is worth: factor = p_survive × pace. The loop's learning curve."
    />

    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        v-for="r in cal.latest"
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
