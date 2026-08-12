<script setup lang="ts">
import { SearchXIcon } from '@lucide/vue'
import { toast } from 'vue-sonner'
import ConfirmDialog from '@/components/states/ConfirmDialog.vue'
import EmptyState from '@/components/states/EmptyState.vue'
import ErrorState from '@/components/states/ErrorState.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
</script>

<template>
  <div class="space-y-8">
    <div class="grid gap-6 md:grid-cols-2">
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          EmptyState — with an #action that creates the first thing
        </h3>
        <EmptyState
          :icon="SearchXIcon"
          title="No results"
          description="Nothing matches those filters yet."
        >
          <template #action>
            <Button size="sm" variant="outline" @click="toast('Filters cleared')">
              Clear filters
            </Button>
          </template>
        </EmptyState>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          ErrorState — default retry button emits @retry
        </h3>
        <ErrorState
          description="The request timed out after 30 seconds."
          @retry="toast.success('Retried — it worked this time')"
        />
      </div>
    </div>

    <div class="grid gap-6 md:grid-cols-2">
      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          ConfirmDialog — wraps any trigger; used by the Settings danger zone
        </h3>
        <Card class="flex-row items-center justify-between gap-4 p-5">
          <p class="text-sm text-muted-foreground">Nothing happens until you confirm.</p>
          <ConfirmDialog
            destructive
            title="Delete 3 items?"
            description="They'll be gone for good."
            confirm-label="Delete"
            @confirm="toast.error('3 items deleted (not really)')"
          >
            <Button variant="destructive" size="sm">Delete items</Button>
          </ConfirmDialog>
        </Card>
      </div>

      <div class="space-y-3">
        <h3 class="text-sm font-medium text-muted-foreground">
          Loading composition — Skeletons in the shape of the real content
        </h3>
        <Card class="gap-4 p-5">
          <div class="flex items-center gap-3">
            <Skeleton class="size-10 rounded-full" />
            <div class="flex-1 space-y-2">
              <Skeleton class="h-4 w-1/3" />
              <Skeleton class="h-3 w-1/2" />
            </div>
          </div>
          <Skeleton class="h-24 w-full" />
          <div class="flex gap-2">
            <Skeleton class="h-8 w-20" />
            <Skeleton class="h-8 w-20" />
          </div>
        </Card>
      </div>
    </div>
  </div>
</template>
