<script setup lang="ts">
// What the engine is doing this second. A running run shows its mode, time
// against what that mode usually takes, turn and tool counts from the live
// stream; idle says so and names the last run. Polls health on its own, faster
// than the page refresh, and emits `changed` when a run starts or ends.
import { LoaderIcon, MoonIcon } from '@lucide/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { api, timeAgo, type Run } from '@/lib/api'
import { median, OUTCOME, runOutcome } from '@/lib/runs'
import { useRunStream } from '@/lib/runStream'

const POLL_MS = 15_000

const props = defineProps<{ runs: Run[] }>() // recent runs, for what's typical
const emit = defineEmits<{ changed: [] }>()

const activeId = ref<number | null>(null)
const active = ref<Run | null>(null)
const now = ref(Date.now())
const stream = useRunStream(activeId)

const lastRun = computed(() => props.runs.find((r) => r.status !== 'running') ?? null)
const minutes = (r: Run) => (Date.parse(r.finished_at!) - Date.parse(r.started_at)) / 60_000
const typical = computed(() => {
  const mode = active.value?.mode
  return median(props.runs.filter((r) => r.finished_at && r.status === 'succeeded' && r.mode === mode).map(minutes))
})
const elapsedMin = computed(() => (active.value ? Math.max(0, (now.value - Date.parse(active.value.started_at)) / 60_000) : 0))
const elapsedText = computed(() => {
  const s = Math.floor(elapsedMin.value * 60)
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`
})
const pct = computed(() => (typical.value ? Math.min(100, (elapsedMin.value / typical.value) * 100) : null))
const slow = computed(() => typical.value !== null && elapsedMin.value > typical.value * 2)

async function poll() {
  const h = await api.health().catch(() => null)
  if (!h) return
  const id = h.active_run_id || null
  if (id === activeId.value) return
  const res = id ? await api.run(id).catch(() => null) : null
  if (id && !res) return // try again on the next poll
  active.value = res?.run ?? null
  activeId.value = id
  emit('changed')
}

let pollTimer: number | undefined
let tickTimer: number | undefined
onMounted(() => {
  poll()
  pollTimer = window.setInterval(poll, POLL_MS)
  tickTimer = window.setInterval(() => (now.value = Date.now()), 1000)
})
onUnmounted(() => {
  window.clearInterval(pollTimer)
  window.clearInterval(tickTimer)
})
</script>

<template>
  <section class="rounded-md border bg-card p-4" aria-live="polite">
    <div v-if="active" class="space-y-2">
      <div class="flex flex-wrap items-center gap-x-3 gap-y-1">
        <LoaderIcon class="size-4 animate-spin text-chart-3" aria-hidden="true" />
        <RouterLink :to="`/runs/${active.run_id}`" class="text-sm font-medium hover:underline">Run #{{ active.run_id }} is running</RouterLink>
        <span class="font-mono text-xs text-muted-foreground">{{ active.mode }} · {{ active.trigger_source ?? 'unknown trigger' }}</span>
        <span class="ml-auto font-mono text-sm tabular-nums">{{ elapsedText }}</span>
      </div>
      <div v-if="pct !== null" class="h-1.5 bg-muted" role="img" :aria-label="`${Math.round(pct)}% of a typical ${active.mode} run`">
        <div class="h-full" :class="slow ? 'bg-warning' : 'bg-chart-3'" :style="{ width: `${pct}%` }" />
      </div>
      <p class="text-xs text-muted-foreground">
        <template v-if="typical !== null">Typical {{ active.mode }} run: {{ Math.max(1, Math.round(typical)) }}m.</template>
        <strong v-if="slow" class="font-medium text-warning"> Taking longer than usual.</strong>
        Turn {{ stream.turns.value }} · {{ stream.toolCalls.value }} tool calls<template v-if="stream.lastTool.value"> · last: <span class="font-mono">{{ stream.lastTool.value }}</span></template><template v-if="stream.rejections.value"> · {{ stream.rejections.value }} report rejection{{ stream.rejections.value === 1 ? '' : 's' }}</template><template v-if="stream.accepted.value"> · report accepted</template>
      </p>
    </div>
    <div v-else class="flex flex-wrap items-center gap-x-3 gap-y-1">
      <MoonIcon class="size-4 text-muted-foreground" aria-hidden="true" />
      <span class="text-sm font-medium">Engine idle, no run in progress</span>
      <span v-if="lastRun" class="text-xs text-muted-foreground">
        Last:
        <RouterLink :to="`/runs/${lastRun.run_id}`" class="font-mono hover:underline">#{{ lastRun.run_id }}</RouterLink>
        {{ lastRun.mode }}, {{ OUTCOME[runOutcome(lastRun)].label }}, {{ timeAgo(lastRun.started_at) }}
      </span>
    </div>
  </section>
</template>
