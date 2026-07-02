<script setup lang="ts">
import { computed } from 'vue'
import type { MacroTotals } from '@/types/log'

const props = defineProps<{
  totals: MacroTotals
  targets?: { calories?: number; proteinG?: number }
}>()

const caloriePercent = computed(() => {
  if (!props.targets?.calories) return 0
  return Math.min(100, (props.totals.calories / props.targets.calories) * 100)
})

const proteinPercent = computed(() => {
  if (!props.targets?.proteinG) return 0
  return Math.min(100, (props.totals.proteinG / props.targets.proteinG) * 100)
})
</script>

<template>
  <div class="card p-4">
    <h3 class="mb-3 text-sm font-medium text-gray-700">오늘 영양 합계</h3>
    <div class="grid grid-cols-4 gap-3 text-center">
      <div>
        <p class="text-lg font-bold text-gray-900">{{ Math.round(totals.calories) }}</p>
        <p class="text-xs text-gray-400">kcal</p>
      </div>
      <div>
        <p class="text-lg font-bold text-gray-900">{{ Math.round(totals.carbsG) }}g</p>
        <p class="text-xs text-gray-400">탄수</p>
      </div>
      <div>
        <p class="text-lg font-bold text-gray-900">{{ Math.round(totals.proteinG) }}g</p>
        <p class="text-xs text-gray-400">단백</p>
      </div>
      <div>
        <p class="text-lg font-bold text-gray-900">{{ Math.round(totals.fatG) }}g</p>
        <p class="text-xs text-gray-400">지방</p>
      </div>
    </div>
    <div v-if="targets?.calories" class="mt-3">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>칼로리 목표</span>
        <span>{{ Math.round(totals.calories) }} / {{ targets.calories }}</span>
      </div>
      <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          class="h-full rounded-full bg-primary-500 transition-all"
          :style="{ width: `${caloriePercent}%` }"
        />
      </div>
    </div>
    <div v-if="targets?.proteinG" class="mt-2">
      <div class="flex justify-between text-xs text-gray-400 mb-1">
        <span>단백질 목표</span>
        <span>{{ Math.round(totals.proteinG) }} / {{ targets.proteinG }}g</span>
      </div>
      <div class="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div
          class="h-full rounded-full bg-blue-500 transition-all"
          :style="{ width: `${proteinPercent}%` }"
        />
      </div>
    </div>
  </div>
</template>
