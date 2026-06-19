<script setup lang="ts">
import { onMounted } from 'vue'
import { RouterView } from 'vue-router'
import AppNav from '@/components/layout/AppNav.vue'
import { useSettingsStore } from '@/stores/settings'

const settingsStore = useSettingsStore()

onMounted(() => {
  void settingsStore.load()
})
</script>

<template>
  <div class="app-shell">
    <div class="app-frame">
      <RouterView />
      <AppNav />
    </div>
  </div>
</template>
