<script setup lang="ts">
import { computed, ref } from 'vue'
import { toast } from 'vue-sonner'
import PageHeader from '@/components/PageHeader.vue'
import FormField from '@/components/forms/FormField.vue'
import SettingsSection from '@/components/forms/SettingsSection.vue'
import TagInput from '@/components/forms/TagInput.vue'
import ConfirmDialog from '@/components/states/ConfirmDialog.vue'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useTheme } from '@/composables/useTheme'
import { THEMES, type ThemeId } from '@/lib/themes'

// profile — demo state; the error clears as soon as the field is valid
const name = ref('Jade Fisher')
const email = ref('jade@example.com')
const nameError = computed(() => (name.value.trim() ? undefined : 'Display name is required.'))

// notifications
const productUpdates = ref(true)
const weeklyDigest = ref(false)
const mentions = ref(true)
const digestTimes = ref(['08:00', '17:30'])

// appearance — wired to the real theme system, not a mock
const { theme, mode, setTheme, toggleMode } = useTheme()
const themeModel = computed({
  get: () => theme.value,
  set: (id: ThemeId) => setTheme(id),
})
const darkMode = computed({
  get: () => mode.value === 'dark',
  set: () => toggleMode(),
})

function save(what: string) {
  toast.success(`${what} saved`, { description: 'Not really — wire your backend here.' })
}
</script>

<template>
  <div class="mx-auto max-w-2xl space-y-6">
    <PageHeader title="Settings" description="Form patterns in action — see src/components/forms/." />

    <SettingsSection title="Profile" description="How you appear across the app.">
      <FormField v-slot="{ id }" label="Display name" required :error="nameError">
        <Input :id="id" v-model="name" :aria-invalid="!!nameError" />
      </FormField>
      <FormField
        v-slot="{ id }"
        label="Email"
        hint="Used for login and notifications — never shown publicly."
      >
        <Input :id="id" v-model="email" type="email" />
      </FormField>
      <template #footer>
        <Button variant="ghost">Cancel</Button>
        <Button :disabled="!!nameError" @click="save('Profile')">Save</Button>
      </template>
    </SettingsSection>

    <SettingsSection title="Notifications" description="What lands in your inbox.">
      <div class="flex items-center justify-between gap-4">
        <div>
          <Label for="notif-updates">Product updates</Label>
          <p class="text-xs text-muted-foreground">Release notes when something ships.</p>
        </div>
        <Switch id="notif-updates" v-model="productUpdates" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <div>
          <Label for="notif-digest">Weekly digest</Label>
          <p class="text-xs text-muted-foreground">A summary every Monday morning.</p>
        </div>
        <Switch id="notif-digest" v-model="weeklyDigest" />
      </div>
      <div class="flex items-center justify-between gap-4">
        <div>
          <Label for="notif-mentions">Mentions</Label>
          <p class="text-xs text-muted-foreground">When someone @-mentions you.</p>
        </div>
        <Switch id="notif-mentions" v-model="mentions" />
      </div>
      <FormField
        v-slot="{ id }"
        label="Digest times"
        hint="Daily summaries go out at these times."
      >
        <TagInput :id="id" v-model="digestTimes" type="time" mono />
      </FormField>
      <template #footer>
        <Button @click="save('Notifications')">Save</Button>
      </template>
    </SettingsSection>

    <SettingsSection
      title="Appearance"
      description="These actually work — same state as the header controls."
    >
      <FormField v-slot="{ id }" label="Theme preset">
        <Select v-model="themeModel">
          <SelectTrigger :id="id" class="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="t in THEMES" :key="t.id" :value="t.id">{{ t.label }}</SelectItem>
          </SelectContent>
        </Select>
      </FormField>
      <div class="flex items-center justify-between gap-4">
        <div>
          <Label for="appearance-dark">Dark mode</Label>
          <p class="text-xs text-muted-foreground">Dark over light, always.</p>
        </div>
        <Switch id="appearance-dark" v-model="darkMode" />
      </div>
    </SettingsSection>

    <SettingsSection title="Danger zone" description="Irreversible things live at the bottom.">
      <div class="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p class="text-sm font-medium">Delete workspace</p>
          <p class="text-xs text-muted-foreground">Everything, gone. There is no undo.</p>
        </div>
        <ConfirmDialog
          destructive
          title="Delete this workspace?"
          description="All data goes with it. This cannot be undone."
          confirm-label="Delete workspace"
          @confirm="toast.error('Deleted nothing', { description: 'This is a demo, relax.' })"
        >
          <Button variant="destructive">Delete</Button>
        </ConfirmDialog>
      </div>
    </SettingsSection>
  </div>
</template>
