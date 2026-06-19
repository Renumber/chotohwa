<script setup lang="ts">
import type { CardioEntry, CardioType } from '@/types/log'
import { CARDIO_TYPE_LABELS } from '@/types/log'

defineProps<{
  entry: CardioEntry
}>()

const emit = defineEmits<{
  update: [entry: CardioEntry]
  remove: []
}>()

const types = Object.entries(CARDIO_TYPE_LABELS) as [CardioType, string][]
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-3 space-y-2">
    <div class="flex items-center justify-between">
      <select
        :value="entry.type"
        class="rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
        @change="emit('update', { ...entry, type: ($event.target as HTMLSelectElement).value as CardioType })"
      >
        <option v-for="[value, label] in types" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
      <button type="button" class="text-xs text-red-500" @click="emit('remove')">
        삭제
      </button>
    </div>
    <div class="flex gap-2">
      <div class="flex-1">
        <label class="text-xs text-gray-400">시간(분)</label>
        <input
          :value="entry.durationMin"
          type="number"
          inputmode="numeric"
          min="0"
          class="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="emit('update', { ...entry, durationMin: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-400">거리(km)</label>
        <input
          :value="entry.distanceKm ?? ''"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.1"
          class="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="emit('update', { ...entry, distanceKm: Number(($event.target as HTMLInputElement).value) || undefined })"
        />
      </div>
      <div class="flex-1">
        <label class="text-xs text-gray-400">칼로리</label>
        <input
          :value="entry.calories ?? ''"
          type="number"
          inputmode="numeric"
          min="0"
          class="mt-0.5 w-full rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="emit('update', { ...entry, calories: Number(($event.target as HTMLInputElement).value) || undefined })"
        />
      </div>
    </div>
  </div>
</template>
