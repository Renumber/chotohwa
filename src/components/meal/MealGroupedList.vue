<script setup lang="ts">
import { computed } from 'vue'
import MealForm from '@/components/meal/MealForm.vue'
import MealSummaryCard from '@/components/meal/MealSummaryCard.vue'
import { groupMealsByType } from '@/utils/mealGroups'
import type { MealEntry, MealType } from '@/types/log'

const props = defineProps<{
  meals: MealEntry[]
  date?: string
  readonly?: boolean
}>()

const emit = defineEmits<{
  update: [index: number, entry: MealEntry]
  remove: [index: number]
  'manual-add': [mealType: MealType]
}>()

const groups = computed(() => groupMealsByType(props.meals))
</script>

<template>
  <div class="space-y-4">
    <div v-for="group in groups" :key="group.type" class="space-y-2">
      <div class="flex items-center justify-between">
        <p class="text-sm font-medium text-gray-700">{{ group.label }}</p>
        <p v-if="group.items.length" class="text-xs text-gray-400">
          {{ Math.round(group.subtotal.calories) }}kcal
        </p>
      </div>

      <template v-if="readonly">
        <MealSummaryCard
          v-for="{ entry } in group.items"
          :key="entry.id"
          :entry="entry"
          grouped
        />
        <p v-if="!group.items.length" class="text-xs text-gray-400">—</p>
      </template>

      <template v-else>
        <MealForm
          v-for="{ entry, index } in group.items"
          :key="entry.id"
          :entry="entry"
          :date="date"
          grouped
          @update="emit('update', index, $event)"
          @remove="emit('remove', index)"
        />
        <button
          type="button"
          class="w-full rounded-lg border border-dashed border-gray-200 py-2 text-xs text-gray-500 hover:border-primary-500 hover:text-primary-600"
          @click="emit('manual-add', group.type)"
        >
          + {{ group.label }} 추가
        </button>
      </template>
    </div>
  </div>
</template>
