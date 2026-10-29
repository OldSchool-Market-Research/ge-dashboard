// Live pages re-fetch on a timer. Prices land every 30s and 5-minute blocks
// every 5 minutes, so a minute keeps a page current without hammering the
// orchestrator (whose all-items list is itself cached for 30s).
import { onMounted, onUnmounted, ref } from 'vue'

export const REFRESH_MS = 60_000

// useAutoRefresh runs `refresh` every intervalMs while the tab is visible, and
// once on returning to the tab if a refresh was missed. A failed refresh keeps
// the data already on screen and reports the error in `refreshError`; the
// page's first load handles its own errors and calls markUpdated().
export function useAutoRefresh(refresh: () => Promise<void>, intervalMs = REFRESH_MS) {
  const updatedAt = ref<number | null>(null)
  const refreshError = ref<string | null>(null)
  let timer: number | undefined
  let running = false

  async function tick() {
    if (running || document.hidden) return
    running = true
    try {
      await refresh()
      updatedAt.value = Date.now()
      refreshError.value = null
    } catch (e) {
      refreshError.value = String(e)
    } finally {
      running = false
    }
  }

  function onVisibility() {
    if (!document.hidden && updatedAt.value !== null && Date.now() - updatedAt.value >= intervalMs) tick()
  }

  onMounted(() => {
    timer = window.setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', onVisibility)
  })
  onUnmounted(() => {
    window.clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisibility)
  })

  return {
    updatedAt,
    refreshError,
    markUpdated: () => {
      updatedAt.value = Date.now()
      refreshError.value = null
    },
  }
}
