<script setup lang="ts">
import { ref, computed } from 'vue'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/layout/AppHeader.vue'
import ExercisePicker from '@/components/workout/ExercisePicker.vue'
import WorkoutCard from '@/components/workout/WorkoutCard.vue'
import CardioForm from '@/components/cardio/CardioForm.vue'
import MealForm from '@/components/meal/MealForm.vue'
import MacroSummary from '@/components/meal/MacroSummary.vue'
import { useDayLog } from '@/composables/useDayLog'
import { useSettingsStore } from '@/stores/settings'
import { generateId, sumMacros, formatDateKey } from '@/utils/helpers'
import type { WorkoutEntry, CardioEntry, MealEntry } from '@/types/log'

const today = formatDateKey(new Date())
const dateLabel = format(new Date(), 'M월 d일 (EEE)', { locale: ko })

const { log, loading, update } = useDayLog(() => today)
const settingsStore = useSettingsStore()

const showPicker = ref(false)
const openSections = ref({ workout: true, cardio: true, meal: true })

const macroTotals = computed(() => sumMacros(log.value.meals))

function addWorkout(exerciseId: string, exerciseName: string) {
  const entry: WorkoutEntry = {
    id: generateId(),
    exerciseId,
    exerciseName,
    sets: [{ weightKg: 0, reps: 10 }],
  }
  update((draft) => {
    draft.workouts.push(entry)
  })
}

function updateWorkout(index: number, workout: WorkoutEntry) {
  update((draft) => {
    draft.workouts[index] = workout
  })
}

function removeWorkout(index: number) {
  update((draft) => {
    draft.workouts.splice(index, 1)
  })
}

function addCardio() {
  const entry: CardioEntry = {
    id: generateId(),
    type: 'running',
    durationMin: 30,
  }
  update((draft) => {
    draft.cardio.push(entry)
  })
}

function updateCardio(index: number, entry: CardioEntry) {
  update((draft) => {
    draft.cardio[index] = entry
  })
}

function removeCardio(index: number) {
  update((draft) => {
    draft.cardio.splice(index, 1)
  })
}

function addMeal() {
  const entry: MealEntry = {
    id: generateId(),
    name: '',
    calories: 0,
    carbsG: 0,
    proteinG: 0,
    fatG: 0,
    mealType: 'lunch',
  }
  update((draft) => {
    draft.meals.push(entry)
  })
}

function updateMeal(index: number, entry: MealEntry) {
  update((draft) => {
    draft.meals[index] = entry
  })
}

function removeMeal(index: number) {
  update((draft) => {
    draft.meals.splice(index, 1)
  })
}
</script>

<template>
  <div>
    <AppHeader title="오늘" :subtitle="dateLabel" />

    <div v-if="loading" class="p-8 text-center text-gray-400">불러오는 중...</div>

    <div v-else class="space-y-4 p-4 pb-24">
      <!-- 운동 -->
      <section class="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left"
          @click="openSections.workout = !openSections.workout"
        >
          <span class="font-medium">💪 운동 ({{ log.workouts.length }})</span>
          <span class="text-gray-400">{{ openSections.workout ? '▲' : '▼' }}</span>
        </button>
        <div v-show="openSections.workout" class="space-y-3 px-4 pb-4">
          <WorkoutCard
            v-for="(workout, i) in log.workouts"
            :key="workout.id"
            :workout="workout"
            :date="today"
            @update="updateWorkout(i, $event)"
            @remove="removeWorkout(i)"
          />
          <button
            type="button"
            class="w-full rounded-xl border border-dashed border-primary-500 py-3 text-sm text-primary-600"
            @click="showPicker = true"
          >
            + 운동 추가
          </button>
        </div>
      </section>

      <!-- 유산소 -->
      <section class="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left"
          @click="openSections.cardio = !openSections.cardio"
        >
          <span class="font-medium">🏃 유산소 ({{ log.cardio.length }})</span>
          <span class="text-gray-400">{{ openSections.cardio ? '▲' : '▼' }}</span>
        </button>
        <div v-show="openSections.cardio" class="space-y-3 px-4 pb-4">
          <CardioForm
            v-for="(entry, i) in log.cardio"
            :key="entry.id"
            :entry="entry"
            @update="updateCardio(i, $event)"
            @remove="removeCardio(i)"
          />
          <button
            type="button"
            class="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500"
            @click="addCardio"
          >
            + 유산소 추가
          </button>
        </div>
      </section>

      <!-- 식단 -->
      <section class="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left"
          @click="openSections.meal = !openSections.meal"
        >
          <span class="font-medium">🍽️ 식단 ({{ log.meals.length }})</span>
          <span class="text-gray-400">{{ openSections.meal ? '▲' : '▼' }}</span>
        </button>
        <div v-show="openSections.meal" class="space-y-3 px-4 pb-4">
          <MealForm
            v-for="(entry, i) in log.meals"
            :key="entry.id"
            :entry="entry"
            @update="updateMeal(i, $event)"
            @remove="removeMeal(i)"
          />
          <button
            type="button"
            class="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500"
            @click="addMeal"
          >
            + 식단 추가
          </button>
        </div>
      </section>

      <MacroSummary
        v-if="log.meals.length > 0"
        :totals="macroTotals"
        :targets="settingsStore.settings.dailyTargets"
      />
    </div>

    <ExercisePicker
      :open="showPicker"
      @close="showPicker = false"
      @select="addWorkout"
    />
  </div>
</template>
