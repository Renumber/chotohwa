<script setup lang="ts">
import type { MealEntry } from '@/types/log'

defineProps<{
  entry: MealEntry
  grouped?: boolean
}>()
</script>

<template>
  <div class="flex items-center justify-between gap-2 rounded-lg bg-gray-100 px-3 py-2">
    <p class="min-w-0 truncate text-sm font-medium text-gray-900">{{ entry.name }}</p>
    <div class="shrink-0 text-right">
      <p class="text-sm font-medium text-gray-900">{{ entry.calories }}kcal</p>
      <p class="text-xs text-gray-400">단백 {{ entry.proteinG }}g</p>
    </div>
  </div>
</template>
