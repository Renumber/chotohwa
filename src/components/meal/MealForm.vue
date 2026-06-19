<script setup lang="ts">
import type { MealEntry, MealType } from '@/types/log'
import { MEAL_TYPE_LABELS } from '@/types/log'

defineProps<{
  entry: MealEntry
}>()

const emit = defineEmits<{
  update: [entry: MealEntry]
  remove: []
}>()

const mealTypes = Object.entries(MEAL_TYPE_LABELS) as [MealType, string][]
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
    <div class="flex items-center gap-2">
      <select
        :value="entry.mealType"
        class="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        @change="emit('update', { ...entry, mealType: ($event.target as HTMLSelectElement).value as MealType })"
      >
        <option v-for="[value, label] in mealTypes" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
      <input
        :value="entry.name"
        type="text"
        placeholder="음식 이름"
        class="flex-1 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        @input="emit('update', { ...entry, name: ($event.target as HTMLInputElement).value })"
      />
      <button type="button" class="text-xs text-red-500 shrink-0" @click="emit('remove')">
        삭제
      </button>
    </div>
    <div class="grid grid-cols-4 gap-2">
      <div>
        <label class="text-xs text-gray-400">kcal</label>
        <input
          :value="entry.calories"
          type="number"
          inputmode="numeric"
          min="0"
          class="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="emit('update', { ...entry, calories: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div>
        <label class="text-xs text-gray-400">탄수</label>
        <input
          :value="entry.carbsG"
          type="number"
          inputmode="decimal"
          min="0"
          class="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="emit('update', { ...entry, carbsG: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div>
        <label class="text-xs text-gray-400">단백</label>
        <input
          :value="entry.proteinG"
          type="number"
          inputmode="decimal"
          min="0"
          class="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="emit('update', { ...entry, proteinG: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div>
        <label class="text-xs text-gray-400">지방</label>
        <input
          :value="entry.fatG"
          type="number"
          inputmode="decimal"
          min="0"
          class="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="emit('update', { ...entry, fatG: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
    </div>
  </div>
</template>
