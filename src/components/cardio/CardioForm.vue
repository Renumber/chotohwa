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
  <div class="card p-3 space-y-2">
    <div class="flex items-center justify-between">
      <select
        :value="entry.type"
        class="input w-auto px-2 py-1.5"
        aria-label="유산소 종류"
        @change="emit('update', { ...entry, type: ($event.target as HTMLSelectElement).value as CardioType })"
      >
        <option v-for="[value, label] in types" :key="value" :value="value">
          {{ label }}
        </option>
      </select>
      <button type="button" class="btn-danger-ghost" @click="emit('remove')">
        삭제
      </button>
    </div>
    <div class="flex gap-2">
      <div class="flex-1">
        <label class="field-label">시간(분)</label>
        <input
          :value="entry.durationMin"
          type="number"
          inputmode="numeric"
          min="0"
          class="input mt-0.5 px-2 py-1.5"
          @input="emit('update', { ...entry, durationMin: Number(($event.target as HTMLInputElement).value) })"
        />
      </div>
      <div class="flex-1">
        <label class="field-label">거리(km)</label>
        <input
          :value="entry.distanceKm ?? ''"
          type="number"
          inputmode="decimal"
          min="0"
          step="0.1"
          class="input mt-0.5 px-2 py-1.5"
          @input="emit('update', { ...entry, distanceKm: Number(($event.target as HTMLInputElement).value) || undefined })"
        />
      </div>
      <div class="flex-1">
        <label class="field-label">칼로리</label>
        <input
          :value="entry.calories ?? ''"
          type="number"
          inputmode="numeric"
          min="0"
          class="input mt-0.5 px-2 py-1.5"
          @input="emit('update', { ...entry, calories: Number(($event.target as HTMLInputElement).value) || undefined })"
        />
      </div>
    </div>
  </div>
</template>
