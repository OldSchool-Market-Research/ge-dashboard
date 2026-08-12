<script setup lang="ts">
import { PlusIcon, XIcon } from '@lucide/vue'
import { useLocalStorage } from '@vueuse/core'
import { ref } from 'vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uid } from '@/lib/utils'

interface Note {
  id: string
  text: string
  at: number
}

// quick scratch notes, persisted to localStorage — swap the storage ref
// for an API call when a backend shows up.
const props = withDefaults(
  defineProps<{
    storageKey?: string
    /** first-run content, used only when nothing is stored yet */
    seed?: { text: string; at: number }[]
  }>(),
  { storageKey: 'app.notes' },
)

const notes = useLocalStorage<Note[]>(props.storageKey, () =>
  (props.seed ?? []).map((s) => ({ id: uid(), ...s })),
)
const draft = ref('')

function addNote() {
  const text = draft.value.trim()
  if (!text) return
  notes.value = [{ id: uid(), text, at: Date.now() }, ...notes.value]
  draft.value = ''
}

function removeNote(id: string) {
  notes.value = notes.value.filter((n) => n.id !== id)
}

function rel(at: number) {
  const s = Math.round((Date.now() - at) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(at).toLocaleDateString()
}
</script>

<template>
  <div class="space-y-4">
    <form class="flex gap-2" @submit.prevent="addNote">
      <Input v-model="draft" placeholder="Jot something down…" />
      <Button type="submit" size="icon" aria-label="Add note" :disabled="!draft.trim()">
        <PlusIcon />
      </Button>
    </form>
    <p v-if="!notes.length" class="text-sm text-muted-foreground">
      Nothing here yet — notes stick around in localStorage.
    </p>
    <ul v-else class="space-y-1">
      <li
        v-for="note in notes"
        :key="note.id"
        class="group -mx-2 flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-muted/60"
      >
        <div class="min-w-0 flex-1">
          <p class="text-sm">{{ note.text }}</p>
          <p class="text-xs text-muted-foreground">{{ rel(note.at) }}</p>
        </div>
        <button
          class="rounded p-1 text-muted-foreground/50 transition-colors hover:text-destructive"
          :aria-label="`Delete note: ${note.text}`"
          @click="removeNote(note.id)"
        >
          <XIcon class="size-3.5" />
        </button>
      </li>
    </ul>
  </div>
</template>
