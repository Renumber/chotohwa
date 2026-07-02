<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppNav from '@/components/layout/AppNav.vue'
import OnboardingWizard from '@/components/onboarding/OnboardingWizard.vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

const showOnboarding = computed(
  () => settingsStore.loaded && !settingsStore.settings.onboarded,
)

onMounted(() => {
  void settingsStore.load()
})
</script>

<template>
  <div class="app-shell">
    <div class="app-frame">
      <RouterView />
      <AppNav />
      <OnboardingWizard v-if="showOnboarding" />
    </div>
  </div>
</template>
