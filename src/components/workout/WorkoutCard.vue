<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { WorkoutEntry } from '@/types/log'
import { findRecentWorkoutSets } from '@/db'
import { getHeaviestSet, formatSetLabel } from '@/services/insights/workoutStats'

const props = defineProps<{
  workout: WorkoutEntry
  date: string
  canMoveUp?: boolean
  canMoveDown?: boolean
}>()

const emit = defineEmits<{
  update: [workout: WorkoutEntry]
  remove: []
  moveUp: []
  moveDown: []
}>()

const lastSets = ref<{ date: string; sets: { weightKg: number; reps: number }[] } | null>(null)

async function loadLast() {
  const recent = await findRecentWorkoutSets(props.workout.exerciseId, props.date, 1)
  lastSets.value = recent[0] ?? null
}

watch(() => [props.workout.exerciseId, props.workout.sets] as const, loadLast, { immediate: true, deep: true })

const previousHint = computed(() => {
  if (!lastSets.value) return null
  return {
    dateLabel: lastSets.value.date,
    lastSetsText: lastSets.value.sets.map((s) => `${s.weightKg}kg×${s.reps}`).join(', '),
  }
})

const firstRecordSet = computed(() => {
  if (lastSets.value || props.workout.sets.length === 0) return null
  return getHeaviestSet(props.workout.sets)
})

function updateSet(index: number, field: 'weightKg' | 'reps', value: number) {
  const sets = [...props.workout.sets]
  sets[index] = { ...sets[index], [field]: value }
  emit('update', { ...props.workout, sets })
}

function addSet() {
  const last = props.workout.sets[props.workout.sets.length - 1]
  emit('update', {
    ...props.workout,
    sets: [...props.workout.sets, { weightKg: last?.weightKg ?? 0, reps: last?.reps ?? 10 }],
  })
}

function removeSet(index: number) {
  emit('update', {
    ...props.workout,
    sets: props.workout.sets.filter((_, i) => i !== index),
  })
}

function addInitialSet() {
  emit('update', {
    ...props.workout,
    sets: [{ weightKg: 0, reps: 10 }],
  })
}
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-white p-3">
    <div class="mb-2 flex items-start justify-between gap-2">
      <div class="flex min-w-0 items-start gap-1">
        <div v-if="canMoveUp || canMoveDown" class="flex shrink-0 flex-col gap-0.5">
          <button
            type="button"
            class="rounded px-1 text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            :disabled="!canMoveUp"
            @click="emit('moveUp')"
          >
            ▲
          </button>
          <button
            type="button"
            class="rounded px-1 text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30"
            :disabled="!canMoveDown"
            @click="emit('moveDown')"
          >
            ▼
          </button>
        </div>
        <div class="min-w-0">
        <h3 class="font-medium text-gray-900">{{ workout.exerciseName }}</h3>
        <p v-if="firstRecordSet" class="mt-1 text-xs text-gray-500">
          (첫기록) <span class="font-medium text-gray-800">{{ formatSetLabel(firstRecordSet) }}</span>
        </p>
        <p v-else-if="previousHint" class="mt-1 text-xs text-gray-400">
          이전({{ previousHint.dateLabel }}): {{ previousHint.lastSetsText }}
        </p>
        </div>
      </div>
      <button
        type="button"
        class="text-xs text-red-500"
        @click="emit('remove')"
      >
        삭제
      </button>
    </div>

    <div v-if="workout.sets.length === 0">
      <button
        type="button"
        class="w-full rounded-lg bg-gray-100 py-2 text-sm text-gray-600"
        @click="addInitialSet"
      >
        세트 추가
      </button>
    </div>

    <div v-else class="space-y-2">
      <div
        v-for="(set, i) in workout.sets"
        :key="i"
        class="flex items-center gap-2"
      >
        <span class="w-6 text-xs text-gray-400">{{ i + 1 }}</span>
        <input
          :value="set.weightKg"
          type="number"
          inputmode="decimal"
          min="0"
          class="w-20 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="updateSet(i, 'weightKg', Number(($event.target as HTMLInputElement).value))"
        />
        <span class="text-xs text-gray-400">kg</span>
        <input
          :value="set.reps"
          type="number"
          inputmode="numeric"
          min="0"
          class="w-16 rounded-lg border border-gray-200 px-2 py-1.5 text-sm"
          @input="updateSet(i, 'reps', Number(($event.target as HTMLInputElement).value))"
        />
        <span class="text-xs text-gray-400">회</span>
        <button
          type="button"
          class="ml-auto text-xs text-gray-400"
          @click="removeSet(i)"
        >
          ✕
        </button>
      </div>
      <button
        type="button"
        class="w-full rounded-lg border border-dashed border-gray-200 py-1.5 text-xs text-gray-500"
        @click="addSet"
      >
        + 세트
      </button>
    </div>
  </div>
</template>
