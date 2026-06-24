<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/layout/AppHeader.vue'
import ExercisePicker from '@/components/workout/ExercisePicker.vue'
import WorkoutCard from '@/components/workout/WorkoutCard.vue'
import CategoryComparisonCard from '@/components/workout/CategoryComparisonCard.vue'
import CardioForm from '@/components/cardio/CardioForm.vue'
import MealForm from '@/components/meal/MealForm.vue'
import MacroSummary from '@/components/meal/MacroSummary.vue'
import WeeklyMealPanel from '@/components/meal/WeeklyMealPanel.vue'
import { useDayLog } from '@/composables/useDayLog'
import { useSettingsStore } from '@/stores/settings'
import { getTodayCategoryComparisons, type CategoryComparison } from '@/services/insights/workoutStats'
import { generateId, sumMacros, formatDateKey } from '@/utils/helpers'
import type { WorkoutEntry, CardioEntry, MealEntry } from '@/types/log'

const today = formatDateKey(new Date())
const dateLabel = format(new Date(), 'M월 d일 (EEE)', { locale: ko })

const { log, loading, saving, update } = useDayLog(() => today)
const settingsStore = useSettingsStore()

const showPicker = ref(false)
const openSections = ref({ workout: true, cardio: true, meal: true })
const categoryComparisons = ref<CategoryComparison[]>([])

const macroTotals = computed(() => sumMacros(log.value.meals))

const totalWorkoutSets = computed(() =>
  log.value.workouts.reduce((sum, w) => sum + w.sets.length, 0),
)

async function loadCategoryComparisons() {
  if (log.value.workouts.length === 0) {
    categoryComparisons.value = []
    return
  }
  categoryComparisons.value = await getTodayCategoryComparisons(log.value)
}

watch(
  () => log.value.workouts,
  () => { void loadCategoryComparisons() },
  { deep: true, immediate: true },
)

function addWorkout(exerciseId: string, exerciseName: string) {
  const entry: WorkoutEntry = {
    id: generateId(),
    exerciseId,
    exerciseName,
    sets: [{ weightKg: 0, reps: 10 }],
  }
  update((draft) => {
    draft.workouts.push(entry)
  }, true)
}

function updateWorkout(index: number, workout: WorkoutEntry) {
  update((draft) => {
    draft.workouts[index] = workout
  })
}

function removeWorkout(index: number) {
  update((draft) => {
    draft.workouts.splice(index, 1)
  }, true)
}

function addCardio() {
  const entry: CardioEntry = {
    id: generateId(),
    type: 'running',
    durationMin: 30,
  }
  update((draft) => {
    draft.cardio.push(entry)
  }, true)
}

function updateCardio(index: number, entry: CardioEntry) {
  update((draft) => {
    draft.cardio[index] = entry
  })
}

function removeCardio(index: number) {
  update((draft) => {
    draft.cardio.splice(index, 1)
  }, true)
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
  }, true)
}

function updateMeal(index: number, entry: MealEntry) {
  update((draft) => {
    draft.meals[index] = entry
  })
}

function removeMeal(index: number) {
  update((draft) => {
    draft.meals.splice(index, 1)
  }, true)
}
</script>

<template>
  <div>
    <AppHeader title="오늘" :subtitle="dateLabel" />

    <p
      v-if="saving"
      class="sticky top-0 z-30 bg-primary-600 px-4 py-1 text-center text-xs text-white"
    >
      저장 중...
    </p>

    <div v-if="loading" class="p-8 text-center text-gray-400">불러오는 중...</div>

    <div v-else class="space-y-4 p-4 pb-24">
      <!-- 운동 -->
      <section class="rounded-2xl bg-white border border-gray-200 overflow-hidden">
        <button
          type="button"
          class="flex w-full items-center justify-between px-4 py-3 text-left"
          @click="openSections.workout = !openSections.workout"
        >
          <span class="font-medium">💪 운동 ({{ totalWorkoutSets }}세트)</span>
          <span class="text-gray-400">{{ openSections.workout ? '▲' : '▼' }}</span>
        </button>
        <div v-show="openSections.workout" class="space-y-3 px-4 pb-4">
          <CategoryComparisonCard
            v-for="comp in categoryComparisons"
            :key="comp.category"
            :comparison="comp"
          />
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

      <WeeklyMealPanel />
    </div>

    <ExercisePicker
      :open="showPicker"
      @close="showPicker = false"
      @select="addWorkout"
    />
  </div>
</template>
