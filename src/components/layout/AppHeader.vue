<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <header class="sticky top-0 z-40 border-b border-gray-200 bg-white/95 backdrop-blur px-4 py-3">
    <h1 class="text-lg font-bold text-gray-900">{{ title }}</h1>
    <p v-if="subtitle" class="text-sm text-gray-500">{{ subtitle }}</p>
  </header>
</template>
