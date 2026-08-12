<script setup lang="ts">
import { ref } from 'vue'
import { toast } from 'vue-sonner'
import FormField from '@/components/forms/FormField.vue'
import SettingsSection from '@/components/forms/SettingsSection.vue'
import TagInput from '@/components/forms/TagInput.vue'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'

const name = ref('')
const tags = ref(['vue', 'tailwind'])
</script>

<template>
  <div class="grid gap-6 md:grid-cols-2">
    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        FormField — label, hint, error, required in one wrapper
      </h3>
      <Card class="gap-4 p-5">
        <FormField v-slot="{ id }" label="Project name" hint="Lowercase, no spaces.">
          <Input :id="id" placeholder="my-project" />
        </FormField>
        <FormField
          v-slot="{ id }"
          label="API key"
          required
          error="That key doesn't look right."
        >
          <Input :id="id" model-value="sk-nope" aria-invalid="true" />
        </FormField>
        <FormField
          v-slot="{ id }"
          label="Tags"
          hint="TagInput — removable chips, enter to add (from chore-tracker)."
        >
          <TagInput :id="id" v-model="tags" placeholder="Add a tag…" />
        </FormField>
      </Card>
    </div>

    <div class="space-y-3">
      <h3 class="text-sm font-medium text-muted-foreground">
        SettingsSection — titled card with a footer slot; full demo on the Settings page
      </h3>
      <SettingsSection title="Workspace" description="One card per concern.">
        <FormField v-slot="{ id }" label="Workspace name">
          <Input :id="id" v-model="name" placeholder="Acme Inc." />
        </FormField>
        <template #footer>
          <Button variant="ghost">Cancel</Button>
          <Button @click="toast.success('Saved')">Save</Button>
        </template>
      </SettingsSection>
    </div>
  </div>
</template>
