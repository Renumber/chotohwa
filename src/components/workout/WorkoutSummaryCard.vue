<script setup lang="ts">
import type { WorkoutEntry } from '@/types/log'

defineProps<{
  workout: WorkoutEntry
}>()
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-gray-100 p-3">
    <h4 class="mb-2 font-medium text-gray-900">{{ workout.exerciseName }}</h4>
    <div class="flex flex-wrap gap-1.5">
      <span
        v-for="(set, i) in workout.sets"
        :key="i"
        class="rounded-lg bg-white px-2 py-1 text-xs text-gray-700"
      >
        <span class="text-gray-400">{{ i + 1 }}.</span>
        {{ set.weightKg }}kg × {{ set.reps }}
      </span>
    </div>
    <p v-if="workout.note" class="mt-2 text-xs text-gray-500">{{ workout.note }}</p>
  </div>
</template>
