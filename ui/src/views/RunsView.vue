<script setup lang="ts">
import { PlayIcon, RefreshCwIcon } from '@lucide/vue'
import { onMounted, onUnmounted, ref } from 'vue'
import { toast } from 'vue-sonner'
import { useRouter } from 'vue-router'
import PageHeader from '@/components/PageHeader.vue'
import StatusBadge from '@/components/StatusBadge.vue'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { api, timeAgo, type Run } from '@/lib/api'

const router = useRouter()
const runs = ref<Run[]>([])
const loading = ref(true)

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
        <Button variant="outline" size="sm" @click="load"><RefreshCwIcon /> Refresh</Button>
        <Button size="sm" @click="trigger"><PlayIcon /> Trigger run</Button>
      </template>
    </PageHeader>

    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-20">Run</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Started</TableHead>
          <TableHead class="text-right">Shipped</TableHead>
          <TableHead>Failure</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow
          v-for="r in runs"
          :key="r.run_id"
          class="cursor-pointer"
          @click="router.push(`/runs/${r.run_id}`)"
        >
          <TableCell class="font-medium tabular-nums">#{{ r.run_id }}</TableCell>
          <TableCell><StatusBadge :state="r.status" /></TableCell>
          <TableCell class="text-muted-foreground">{{ timeAgo(r.started_at) }}</TableCell>
          <TableCell class="text-right tabular-nums">{{ r.strategy_count ?? 0 }}</TableCell>
          <TableCell class="max-w-md truncate text-xs text-muted-foreground">
            {{ r.fail_reason ?? '' }}
          </TableCell>
        </TableRow>
        <TableRow v-if="!loading && runs.length === 0">
          <TableCell colspan="5" class="text-center text-muted-foreground">no runs yet</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
