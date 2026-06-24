<script setup lang="ts">
import type { CategoryComparison } from '@/services/insights/workoutStats'
import { formatSetLabel } from '@/services/insights/workoutStats'

defineProps<{
  comparison: CategoryComparison
}>()
</script>

<template>
  <div class="rounded-xl border border-primary-100 bg-primary-50/50 p-3">
    <div class="mb-2 flex items-center justify-between">
      <h4 class="text-sm font-medium text-gray-900">
        {{ comparison.categoryLabel }}({{ comparison.currentSetCount }}세트)
      </h4>
      <span v-if="comparison.lastDateLabel" class="text-xs text-gray-400">
        이전 {{ comparison.lastDateLabel }}
      </span>
    </div>

    <div class="space-y-2">
      <div
        v-for="ex in comparison.exerciseComparisons"
        :key="ex.exerciseId"
        class="text-sm"
      >
        <div class="flex items-center justify-between gap-2">
          <span class="text-gray-700 truncate">{{ ex.exerciseName }}</span>
          <span v-if="ex.lastHeaviest" class="shrink-0 font-medium text-gray-900">
            {{ formatSetLabel(ex.currentHeaviest) }}
          </span>
          <span v-else class="shrink-0 text-xs text-gray-500">
            (첫기록) <span class="font-medium text-gray-900">{{ formatSetLabel(ex.currentHeaviest) }}</span>
          </span>
        </div>
        <p v-if="ex.lastHeaviest" class="mt-0.5 text-right text-xs text-gray-400">
          이전 {{ formatSetLabel(ex.lastHeaviest) }}
        </p>
      </div>
    </div>
  </div>
</template>
