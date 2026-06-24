<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths } from 'date-fns'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/layout/AppHeader.vue'
import WorkoutCard from '@/components/workout/WorkoutCard.vue'
import CardioForm from '@/components/cardio/CardioForm.vue'
import MealForm from '@/components/meal/MealForm.vue'
import MacroSummary from '@/components/meal/MacroSummary.vue'
import WeeklyMealPanel from '@/components/meal/WeeklyMealPanel.vue'
import ExercisePicker from '@/components/workout/ExercisePicker.vue'
import { useDayLog } from '@/composables/useDayLog'
import { getDatesWithLogs } from '@/db'
import { buildCoachContext } from '@/services/coach/aggregator'
import { generateId, sumMacros, formatDateKey } from '@/utils/helpers'
import type { WorkoutEntry, CardioEntry, MealEntry } from '@/types/log'

const currentMonth = ref(new Date())
const datesWithLogs = ref<Set<string>>(new Set())
const selectedDate = ref<string | null>(null)
const editing = ref(false)
const weeklySummary = ref<{ workoutDays: number; avgCalories: number; avgProteinG: number } | null>(null)
const showPicker = ref(false)

const { log: selectedLog, saving, update, flushSave, reload } = useDayLog(() => selectedDate.value)

const monthLabel = computed(() =>
  format(currentMonth.value, 'yyyy년 M월', { locale: ko }),
)

const calendarDays = computed(() => {
  const start = startOfMonth(currentMonth.value)
  const end = endOfMonth(currentMonth.value)
  const days = eachDayOfInterval({ start, end })
  const startPad = start.getDay()
  return { days, startPad }
})

async function loadDates() {
  const dates = await getDatesWithLogs()
  datesWithLogs.value = new Set(dates)
}

async function loadWeeklySummary() {
  const ctx = await buildCoachContext(7)
  weeklySummary.value = {
    workoutDays: ctx.summary.workoutDays,
    avgCalories: Math.round(ctx.summary.avgCalories),
    avgProteinG: Math.round(ctx.summary.avgProteinG),
  }
}

async function selectDate(dateStr: string) {
  if (editing.value) {
    await flushSave()
    editing.value = false
  }
  selectedDate.value = dateStr
}

function prevMonth() {
  currentMonth.value = subMonths(currentMonth.value, 1)
}

function nextMonth() {
  currentMonth.value = addMonths(currentMonth.value, 1)
}

async function startEditing() {
  editing.value = true
}

async function finishEditing() {
  await flushSave()
  editing.value = false
  await loadDates()
}

function addWorkout(exerciseId: string, exerciseName: string) {
  const entry: WorkoutEntry = {
    id: generateId(),
    exerciseId,
    exerciseName,
    sets: [{ weightKg: 0, reps: 10 }],
  }
  update((d) => d.workouts.push(entry), true)
}

function addCardio() {
  const entry: CardioEntry = {
    id: generateId(),
    type: 'running',
    durationMin: 30,
  }
  update((d) => d.cardio.push(entry), true)
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
  update((d) => d.meals.push(entry), true)
}

onMounted(async () => {
  await refresh()
})

onActivated(async () => {
  await refresh()
  if (selectedDate.value) {
    await reload()
  }
})

async function refresh() {
  await loadDates()
  await loadWeeklySummary()
}
</script>

<template>
  <div>
    <AppHeader title="기록" subtitle="과거 로그 조회" />

    <p
      v-if="saving"
      class="sticky top-0 z-30 bg-primary-600 px-4 py-1 text-center text-xs text-white"
    >
      저장 중...
    </p>

    <div class="space-y-4 p-4 pb-24">
      <WeeklyMealPanel />

      <div v-if="weeklySummary" class="rounded-xl bg-white border border-gray-200 p-4">
        <h3 class="text-sm font-medium text-gray-700 mb-2">최근 7일 요약</h3>
        <div class="grid grid-cols-3 gap-2 text-center text-sm">
          <div>
            <p class="font-bold text-primary-600">{{ weeklySummary.workoutDays }}일</p>
            <p class="text-xs text-gray-400">운동</p>
          </div>
          <div>
            <p class="font-bold">{{ weeklySummary.avgCalories }}</p>
            <p class="text-xs text-gray-400">평균 kcal</p>
          </div>
          <div>
            <p class="font-bold">{{ weeklySummary.avgProteinG }}g</p>
            <p class="text-xs text-gray-400">평균 단백</p>
          </div>
        </div>
      </div>

      <div class="rounded-xl bg-white border border-gray-200 p-4">
        <div class="mb-3 flex items-center justify-between">
          <button type="button" class="px-2 text-gray-500" @click="prevMonth">◀</button>
          <span class="font-medium">{{ monthLabel }}</span>
          <button type="button" class="px-2 text-gray-500" @click="nextMonth">▶</button>
        </div>
        <div class="grid grid-cols-7 gap-1 text-center text-xs text-gray-400 mb-1">
          <span v-for="d in ['일','월','화','수','목','금','토']" :key="d">{{ d }}</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <div v-for="n in calendarDays.startPad" :key="`pad-${n}`" />
          <button
            v-for="day in calendarDays.days"
            :key="day.toISOString()"
            type="button"
            class="relative aspect-square rounded-lg text-sm"
            :class="[
              selectedDate === formatDateKey(day)
                ? 'bg-primary-600 text-white'
                : isSameMonth(day, currentMonth)
                  ? 'hover:bg-gray-100'
                  : 'text-gray-300',
            ]"
            @click="selectDate(formatDateKey(day))"
          >
            {{ format(day, 'd') }}
            <span
              v-if="datesWithLogs.has(formatDateKey(day))"
              class="absolute bottom-1 left-1/2 h-1 w-1 -translate-x-1/2 rounded-full"
              :class="selectedDate === formatDateKey(day) ? 'bg-white' : 'bg-primary-500'"
            />
          </button>
        </div>
      </div>

      <div v-if="selectedDate && selectedLog" class="rounded-xl bg-white border border-gray-200 p-4 space-y-4">
        <div class="flex items-center justify-between">
          <h3 class="font-medium">{{ selectedDate }}</h3>
          <button
            type="button"
            class="text-sm text-primary-600"
            @click="editing ? finishEditing() : startEditing()"
          >
            {{ editing ? '완료' : '수정' }}
          </button>
        </div>

        <template v-if="!editing">
          <div v-if="selectedLog.workouts.length">
            <p class="text-xs text-gray-400 mb-1">운동</p>
            <p
              v-for="w in selectedLog.workouts"
              :key="w.id"
              class="text-sm"
            >
              {{ w.exerciseName }}: {{ w.sets.map(s => `${s.weightKg}kg×${s.reps}`).join(', ') }}
            </p>
          </div>
          <div v-if="selectedLog.cardio.length">
            <p class="text-xs text-gray-400 mb-1">유산소</p>
            <p v-for="c in selectedLog.cardio" :key="c.id" class="text-sm">
              {{ c.type }} {{ c.durationMin }}분
            </p>
          </div>
          <div v-if="selectedLog.meals.length">
            <p class="text-xs text-gray-400 mb-1">식단</p>
            <p v-for="m in selectedLog.meals" :key="m.id" class="text-sm">
              {{ m.name }} — {{ m.calories }}kcal
            </p>
            <MacroSummary :totals="sumMacros(selectedLog.meals)" />
          </div>
          <p
            v-if="!selectedLog.workouts.length && !selectedLog.cardio.length && !selectedLog.meals.length"
            class="text-sm text-gray-400"
          >
            기록 없음
          </p>
        </template>

        <template v-else>
          <div class="space-y-2">
            <WorkoutCard
              v-for="(w, i) in selectedLog.workouts"
              :key="w.id"
              :workout="w"
              :date="selectedDate"
              @update="(v) => update((d) => { d.workouts[i] = v })"
              @remove="() => update((d) => d.workouts.splice(i, 1), true)"
            />
            <button
              type="button"
              class="w-full rounded-lg border border-dashed py-2 text-sm text-primary-600"
              @click="showPicker = true"
            >
              + 운동
            </button>
          </div>
          <div class="space-y-2">
            <CardioForm
              v-for="(c, i) in selectedLog.cardio"
              :key="c.id"
              :entry="c"
              @update="(v) => update((d) => { d.cardio[i] = v })"
              @remove="() => update((d) => d.cardio.splice(i, 1), true)"
            />
            <button
              type="button"
              class="w-full rounded-lg border border-dashed py-2 text-sm text-gray-500"
              @click="addCardio"
            >
              + 유산소
            </button>
          </div>
          <div class="space-y-2">
            <MealForm
              v-for="(m, i) in selectedLog.meals"
              :key="m.id"
              :entry="m"
              @update="(v) => update((d) => { d.meals[i] = v })"
              @remove="() => update((d) => d.meals.splice(i, 1), true)"
            />
            <button
              type="button"
              class="w-full rounded-lg border border-dashed py-2 text-sm text-gray-500"
              @click="addMeal"
            >
              + 식단
            </button>
          </div>
        </template>
      </div>
    </div>

    <ExercisePicker
      :open="showPicker"
      @close="showPicker = false"
      @select="addWorkout"
    />
  </div>
</template>
