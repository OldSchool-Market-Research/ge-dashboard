// A running run's live progress from GET /api/runs/{id}/events. Event types are
// what ge-orchestrator's runner publishes (internal/runner, parseLine): each SSE
// data field is the whole event as JSON, {id, type, data}. Events are replayed
// from the run's start on connect, so opening mid-run still counts everything.
import { onUnmounted, ref, watch, type Ref } from 'vue'

const EVENT_TYPES = ['started', 'turn', 'tool', 'report_accepted', 'report_rejected', 'log', 'vetoed', 'finished'] as const

const MAX_LINES = 500

const KIMI_TURN = /kimi turn (\d+): \d+ tool call/
// "ge-agent: 2026/11/02 10:25:13 text" -> "10:25:13 text"
const LOG_PREFIX = /^(?:ge-agent: )?\d{4}\/\d{2}\/\d{2} (\d{2}:\d{2}:\d{2})\s+/

export function useRunStream(runId: Ref<number | null>, onFinished?: () => void) {
  const turns = ref(0)
  const toolCalls = ref(0)
  const lastTool = ref<string | null>(null)
  const toolErrors = ref(0)
  const rejections = ref(0)
  const vetoes = ref(0)
  const accepted = ref(false)
  const lines = ref<string[]>([])
  let es: EventSource | null = null

  function say(line: string) {
    lines.value.push(line)
    if (lines.value.length > MAX_LINES) lines.value.splice(0, lines.value.length - MAX_LINES)
  }

  function handle(type: (typeof EVENT_TYPES)[number], raw: string) {
    let d: Record<string, unknown> = {}
    try {
      d = JSON.parse(raw).data ?? {}
    } catch {
      return
    }
    switch (type) {
      case 'started':
        say('Run started')
        break
      case 'turn':
        turns.value = Math.max(turns.value, Number(d.n) || 0)
        break
      case 'tool':
        toolCalls.value++
        lastTool.value = String(d.name)
        if (d.err) toolErrors.value++
        say(`${d.err ? 'Tool error' : 'Tool'}: ${d.name} (${d.bytes} bytes)`)
        break
      case 'report_accepted':
        accepted.value = true
        say('Report accepted')
        break
      case 'report_rejected':
        rejections.value++
        say(`Report rejected: ${d.detail}`)
        break
      case 'vetoed':
        vetoes.value++
        say(`Vetoed ${d.sid}: ${d.reason}`)
        break
      case 'log': {
        const line = String(d.line ?? '')
        const turn = line.match(KIMI_TURN)
        if (turn) turns.value = Math.max(turns.value, Number(turn[1]))
        say(line.replace(LOG_PREFIX, '$1 '))
        break
      }
      case 'finished':
        say(`Finished: ${d.status}${d.reason ? `, ${d.reason}` : ''}`)
        es?.close()
        es = null
        onFinished?.()
        break
    }
  }

  watch(
    runId,
    (id) => {
      es?.close()
      es = null
      turns.value = 0
      toolCalls.value = 0
      lastTool.value = null
      toolErrors.value = 0
      rejections.value = 0
      vetoes.value = 0
      accepted.value = false
      lines.value = []
      if (id === null) return
      es = new EventSource(`/api/runs/${id}/events`)
      for (const t of EVENT_TYPES) es.addEventListener(t, (e) => handle(t, (e as MessageEvent).data))
    },
    { immediate: true },
  )
  onUnmounted(() => es?.close())

  return { turns, toolCalls, lastTool, toolErrors, rejections, vetoes, accepted, lines }
}
