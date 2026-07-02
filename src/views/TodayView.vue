<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { format } from 'date-fns'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/layout/AppHeader.vue'
import SavingIndicator from '@/components/common/SavingIndicator.vue'
import CollapsibleSection from '@/components/common/CollapsibleSection.vue'
import ExercisePicker from '@/components/workout/ExercisePicker.vue'
import WorkoutCard from '@/components/workout/WorkoutCard.vue'
import CategoryComparisonCard from '@/components/workout/CategoryComparisonCard.vue'
import CardioForm from '@/components/cardio/CardioForm.vue'
import MealGroupedList from '@/components/meal/MealGroupedList.vue'
import MacroSummary from '@/components/meal/MacroSummary.vue'
import { useDayLog } from '@/composables/useDayLog'
import { useSettingsStore } from '@/stores/settings'
import { getTodayCategoryComparisons, type CategoryComparison } from '@/services/insights/workoutStats'
import { sumMacros, formatDateKey } from '@/utils/helpers'
import { createWorkoutEntry, createCardioEntry, createMealEntry, countTotalSets } from '@/utils/entryFactories'
import type { WorkoutEntry, CardioEntry, MealEntry, MealType } from '@/types/log'

const today = formatDateKey(new Date())
const dateLabel = format(new Date(), 'M월 d일 (EEE)', { locale: ko })

const { log, loading, saving, update } = useDayLog(() => today)
const settingsStore = useSettingsStore()

const showPicker = ref(false)
const openSections = ref({ workout: true, cardio: true, meal: true })
const categoryComparisons = ref<CategoryComparison[]>([])

const macroTotals = computed(() => sumMacros(log.value.meals))
const totalWorkoutSets = computed(() => countTotalSets(log.value.workouts))

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
  const entry = createWorkoutEntry(exerciseId, exerciseName)
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

function moveWorkout(index: number, direction: -1 | 1) {
  const target = index + direction
  update((draft) => {
    const [item] = draft.workouts.splice(index, 1)
    draft.workouts.splice(target, 0, item)
  }, true)
}

function addCardio() {
  const entry = createCardioEntry()
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

function addMeal(mealType: MealType = 'lunch') {
  const entry = createMealEntry(mealType)
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

    <SavingIndicator :saving="saving" />

    <div v-if="loading" class="p-8 text-center text-gray-400">불러오는 중...</div>

    <div v-else class="space-y-4 p-4 pb-24">
      <CollapsibleSection
        v-model:open="openSections.workout"
        title="💪 운동"
        :badge="`${totalWorkoutSets}세트`"
      >
        <CategoryComparisonCard
          v-for="comp in categoryComparisons"
          :key="comp.category"
          :comparison="comp"
        />
        <p v-if="!log.workouts.length" class="py-2 text-center text-sm text-gray-400">
          아직 운동 기록이 없어요
        </p>
        <WorkoutCard
          v-for="(workout, i) in log.workouts"
          :key="workout.id"
          :workout="workout"
          :date="today"
          :can-move-up="i > 0"
          :can-move-down="i < log.workouts.length - 1"
          @update="updateWorkout(i, $event)"
          @remove="removeWorkout(i)"
          @move-up="moveWorkout(i, -1)"
          @move-down="moveWorkout(i, 1)"
        />
        <button type="button" class="btn-dashed-primary" @click="showPicker = true">
          + 운동 추가
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        v-model:open="openSections.cardio"
        title="🏃 유산소"
        :badge="`${log.cardio.length}건`"
      >
        <CardioForm
          v-for="(entry, i) in log.cardio"
          :key="entry.id"
          :entry="entry"
          @update="updateCardio(i, $event)"
          @remove="removeCardio(i)"
        />
        <button type="button" class="btn-dashed" @click="addCardio">
          + 유산소 추가
        </button>
      </CollapsibleSection>

      <CollapsibleSection
        v-model:open="openSections.meal"
        title="🍽️ 식단"
        :badge="`${Math.round(macroTotals.calories)}kcal`"
      >
        <MealGroupedList
          :meals="log.meals"
          :date="today"
          @update="updateMeal"
          @remove="removeMeal"
          @manual-add="addMeal"
        />
      </CollapsibleSection>

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
