<script setup lang="ts">
import { EllipsisVerticalIcon, GripVerticalIcon, PlusIcon } from '@lucide/vue'
import { nextTick, ref } from 'vue'
import UserAvatar from '@/components/dashboard/UserAvatar.vue'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { uid } from '@/lib/utils'
import type { KanbanCardData, KanbanColumnData } from './types'

// board state is v-model'd so the parent owns persistence (localStorage,
// API, wherever). dragging uses pointer events + a touch-action:none grip
// handle, so it works with mouse AND touch; the ⋮ menu is the fallback.
const columns = defineModel<KanbanColumnData[]>({ required: true })

// column accents by position: backlog-ish grey → doing → review → done
const COLUMN_DOTS = ['bg-muted-foreground/70', 'bg-sky-500', 'bg-amber-500', 'bg-emerald-500']

const priorityDot: Record<NonNullable<KanbanCardData['priority']>, string> = {
  low: 'bg-muted-foreground',
  medium: 'bg-amber-500',
  high: 'bg-red-500',
}

// ——— drag ———
const drag = ref<{
  card: KanbanCardData
  fromCol: string
  active: boolean
  x: number
  y: number
  startX: number
  startY: number
} | null>(null)
const dropTarget = ref<{ colId: string; beforeId: string | null } | null>(null)

function onHandleDown(e: PointerEvent, card: KanbanCardData, colId: string) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  drag.value = {
    card,
    fromCol: colId,
    active: false,
    x: e.clientX,
    y: e.clientY,
    startX: e.clientX,
    startY: e.clientY,
  }
}

function onHandleMove(e: PointerEvent) {
  if (!drag.value) return
  drag.value.x = e.clientX
  drag.value.y = e.clientY
  if (!drag.value.active) {
    if (Math.hypot(e.clientX - drag.value.startX, e.clientY - drag.value.startY) < 5) return
    drag.value.active = true
  }
  const hit = document.elementFromPoint(e.clientX, e.clientY)
  const colEl = hit?.closest<HTMLElement>('[data-kanban-col]')
  if (!colEl) {
    dropTarget.value = null
    return
  }
  const cardEl = hit?.closest<HTMLElement>('[data-kanban-card]')
  const beforeId = cardEl?.dataset.kanbanCard
  dropTarget.value = {
    colId: colEl.dataset.kanbanCol!,
    beforeId: beforeId && beforeId !== drag.value.card.id ? beforeId : null,
  }
}

function onHandleUp() {
  if (drag.value?.active && dropTarget.value) moveCard(drag.value.card.id, dropTarget.value)
  drag.value = null
  dropTarget.value = null
}

function moveCard(cardId: string, to: { colId: string; beforeId: string | null }) {
  let card: KanbanCardData | undefined
  const stripped = columns.value.map((c) => {
    const found = c.cards.find((k) => k.id === cardId)
    if (found) card = found
    return { ...c, cards: c.cards.filter((k) => k.id !== cardId) }
  })
  if (!card) return
  columns.value = stripped.map((c) => {
    if (c.id !== to.colId) return c
    const cards = [...c.cards]
    const i = to.beforeId ? cards.findIndex((k) => k.id === to.beforeId) : -1
    if (i === -1) cards.push(card!)
    else cards.splice(i, 0, card!)
    return { ...c, cards }
  })
}

function removeCard(cardId: string) {
  columns.value = columns.value.map((c) => ({
    ...c,
    cards: c.cards.filter((k) => k.id !== cardId),
  }))
}

// ——— inline add ———
const addingTo = ref<string | null>(null)
const addDraft = ref('')
const addWrap = ref<HTMLElement>()

async function startAdd(colId: string) {
  addingTo.value = colId
  addDraft.value = ''
  await nextTick()
  addWrap.value?.querySelector('input')?.focus()
}

function commitAdd(colId: string) {
  if (addingTo.value !== colId) return
  const title = addDraft.value.trim()
  if (title) {
    columns.value = columns.value.map((c) =>
      c.id === colId ? { ...c, cards: [...c.cards, { id: uid(), title }] } : c,
    )
  }
  addingTo.value = null
}
</script>

<template>
  <div class="flex gap-4 overflow-x-auto pb-2">
    <div
      v-for="(col, colIndex) in columns"
      :key="col.id"
      :data-kanban-col="col.id"
      class="flex w-72 shrink-0 flex-col self-start rounded-xl border bg-muted/40 transition-colors"
      :class="drag?.active && dropTarget?.colId === col.id ? 'border-ring bg-accent/40' : ''"
    >
      <div class="flex items-center gap-2 px-3 pt-3">
        <span
          class="size-2 shrink-0 rounded-full"
          :class="COLUMN_DOTS[colIndex % COLUMN_DOTS.length]"
        />
        <h3 class="text-sm font-semibold">{{ col.title }}</h3>
        <span class="rounded-full bg-muted px-1.5 text-xs text-muted-foreground tabular-nums">
          {{ col.cards.length }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          class="ml-auto size-7"
          :aria-label="`Add card to ${col.title}`"
          @click="startAdd(col.id)"
        >
          <PlusIcon />
        </Button>
      </div>

      <div class="flex flex-col gap-2 p-3">
        <template v-for="card in col.cards" :key="card.id">
          <div
            v-if="drag?.active && dropTarget?.colId === col.id && dropTarget.beforeId === card.id"
            class="h-0.5 rounded bg-primary"
          />
          <div
            :data-kanban-card="card.id"
            class="rounded-lg border bg-card p-3 shadow-sm"
            :class="drag?.active && drag.card.id === card.id ? 'opacity-40' : ''"
          >
            <div class="flex items-start gap-1.5">
              <button
                class="-m-1 shrink-0 cursor-grab touch-none rounded p-1 text-muted-foreground/50 hover:text-foreground active:cursor-grabbing"
                aria-label="Drag card"
                @pointerdown="onHandleDown($event, card, col.id)"
                @pointermove="onHandleMove"
                @pointerup="onHandleUp"
                @pointercancel="onHandleUp"
              >
                <GripVerticalIcon class="size-4" />
              </button>
              <p class="min-w-0 flex-1 text-sm font-medium">{{ card.title }}</p>
              <DropdownMenu>
                <DropdownMenuTrigger as-child>
                  <Button variant="ghost" size="icon" class="-m-1 size-6" aria-label="Card actions">
                    <EllipsisVerticalIcon />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    v-for="other in columns.filter((c) => c.id !== col.id)"
                    :key="other.id"
                    @click="moveCard(card.id, { colId: other.id, beforeId: null })"
                  >
                    Move to {{ other.title }}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem variant="destructive" @click="removeCard(card.id)">
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
            <div
              v-if="card.tags?.length || card.priority || card.assignee"
              class="mt-2 flex items-center gap-1.5"
            >
              <Badge v-for="tag in card.tags" :key="tag" variant="outline" class="text-[10px]">
                {{ tag }}
              </Badge>
              <span
                v-if="card.priority"
                class="size-1.5 rounded-full"
                :class="priorityDot[card.priority]"
                :title="`${card.priority} priority`"
              />
              <UserAvatar v-if="card.assignee" :name="card.assignee" size="sm" class="ml-auto" />
            </div>
          </div>
        </template>

        <div v-if="addingTo === col.id" ref="addWrap">
          <Input
            v-model="addDraft"
            placeholder="Card title…"
            class="bg-card"
            @keydown.enter="commitAdd(col.id)"
            @keydown.esc="addingTo = null"
            @blur="commitAdd(col.id)"
          />
        </div>
        <button
          v-else
          class="rounded-lg border border-dashed px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:border-ring hover:text-foreground"
          @click="startAdd(col.id)"
        >
          + Add card
        </button>
      </div>
    </div>

    <Teleport to="body">
      <div
        v-if="drag?.active"
        class="pointer-events-none fixed z-50 w-64 -rotate-2 rounded-lg border bg-card p-3 shadow-xl"
        :style="{ left: `${drag.x + 10}px`, top: `${drag.y + 10}px` }"
      >
        <p class="text-sm font-medium">{{ drag.card.title }}</p>
      </div>
    </Teleport>
  </div>
</template>
