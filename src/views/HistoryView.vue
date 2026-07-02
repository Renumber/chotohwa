<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, subMonths, addMonths, parseISO } from 'date-fns'
import { ko } from 'date-fns/locale'
import AppHeader from '@/components/layout/AppHeader.vue'
import SavingIndicator from '@/components/common/SavingIndicator.vue'
import WorkoutCard from '@/components/workout/WorkoutCard.vue'
import WorkoutSummaryCard from '@/components/workout/WorkoutSummaryCard.vue'
import CardioForm from '@/components/cardio/CardioForm.vue'
import MealGroupedList from '@/components/meal/MealGroupedList.vue'
import MacroSummary from '@/components/meal/MacroSummary.vue'
import WeeklyMealPanel from '@/components/meal/WeeklyMealPanel.vue'
import ExercisePicker from '@/components/workout/ExercisePicker.vue'
import { useDayLog } from '@/composables/useDayLog'
import { getDatesWithLogs } from '@/db'
import { buildCoachContext } from '@/services/coach/aggregator'
import { sumMacros, formatDateKey } from '@/utils/helpers'
import { createWorkoutEntry, createCardioEntry, createMealEntry, countTotalSets } from '@/utils/entryFactories'
import { CARDIO_TYPE_LABELS, type MealType } from '@/types/log'

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토']

const todayKey = formatDateKey(new Date())
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

const selectedDateLabel = computed(() => {
  if (!selectedDate.value) return ''
  return format(parseISO(selectedDate.value), 'M월 d일 (EEE)', { locale: ko })
})

const calendarDays = computed(() => {
  const start = startOfMonth(currentMonth.value)
  const end = endOfMonth(currentMonth.value)
  const days = eachDayOfInterval({ start, end })
  const startPad = start.getDay()
  return { days, startPad }
})

const totalWorkoutSets = computed(() =>
  selectedLog.value ? countTotalSets(selectedLog.value.workouts) : 0,
)

const isSelectedLogEmpty = computed(() => {
  const log = selectedLog.value
  if (!log) return true
  return !log.workouts.length && !log.cardio.length && !log.meals.length
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

function goToday() {
  currentMonth.value = new Date()
  void selectDate(todayKey)
}

function prevMonth() {
  currentMonth.value = subMonths(currentMonth.value, 1)
}

function nextMonth() {
  currentMonth.value = addMonths(currentMonth.value, 1)
}

function startEditing() {
  editing.value = true
}

async function finishEditing() {
  await flushSave()
  editing.value = false
  await loadDates()
}

function addWorkout(exerciseId: string, exerciseName: string) {
  const entry = createWorkoutEntry(exerciseId, exerciseName)
  update((d) => d.workouts.push(entry), true)
}

function addCardio() {
  const entry = createCardioEntry()
  update((d) => d.cardio.push(entry), true)
}

function addMeal(mealType: MealType = 'lunch') {
  const entry = createMealEntry(mealType)
  update((d) => d.meals.push(entry), true)
}

function moveWorkout(index: number, direction: -1 | 1) {
  const target = index + direction
  update((d) => {
    const [item] = d.workouts.splice(index, 1)
    d.workouts.splice(target, 0, item)
  }, true)
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

    <SavingIndicator :saving="saving" />

    <div class="space-y-4 p-4 pb-24">
      <WeeklyMealPanel />

      <div v-if="weeklySummary" class="card p-4">
        <h3 class="mb-2 text-sm font-medium text-gray-700">최근 7일 요약</h3>
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

      <div class="card p-4">
        <div class="mb-3 flex items-center justify-between">
          <button
            type="button"
            class="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100"
            aria-label="이전 달"
            @click="prevMonth"
          >
            ◀
          </button>
          <div class="flex items-center gap-2">
            <span class="font-medium">{{ monthLabel }}</span>
            <button
              type="button"
              class="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-200"
              @click="goToday"
            >
              오늘
            </button>
          </div>
          <button
            type="button"
            class="rounded-lg px-2 py-1 text-gray-500 hover:bg-gray-100"
            aria-label="다음 달"
            @click="nextMonth"
          >
            ▶
          </button>
        </div>
        <div class="mb-1 grid grid-cols-7 gap-1 text-center text-xs text-gray-400">
          <span v-for="d in WEEKDAY_LABELS" :key="d">{{ d }}</span>
        </div>
        <div class="grid grid-cols-7 gap-1">
          <div v-for="n in calendarDays.startPad" :key="`pad-${n}`" />
          <button
            v-for="day in calendarDays.days"
            :key="day.toISOString()"
            type="button"
            class="relative aspect-square rounded-lg text-sm transition-colors"
            :class="[
              selectedDate === formatDateKey(day)
                ? 'bg-primary-600 font-medium text-white'
                : isSameMonth(day, currentMonth)
                  ? 'hover:bg-gray-100'
                  : 'text-gray-300',
              formatDateKey(day) === todayKey && selectedDate !== formatDateKey(day)
                ? 'ring-1 ring-inset ring-primary-500 font-medium text-primary-600'
                : '',
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

      <p v-if="!selectedDate" class="text-center text-sm text-gray-400">
        날짜를 선택하면 기록을 볼 수 있어요
      </p>

      <div v-if="selectedDate && selectedLog" class="card space-y-4 p-4">
        <div class="flex items-center justify-between">
          <h3 class="font-medium">{{ selectedDateLabel }}</h3>
          <button
            type="button"
            class="btn-secondary px-3 py-1.5"
            @click="editing ? finishEditing() : startEditing()"
          >
            {{ editing ? '완료' : '수정' }}
          </button>
        </div>

        <template v-if="!editing">
          <div v-if="selectedLog.workouts.length" class="space-y-2">
            <p class="text-xs text-gray-400">운동 · 총 {{ totalWorkoutSets }}세트</p>
            <WorkoutSummaryCard
              v-for="w in selectedLog.workouts"
              :key="w.id"
              :workout="w"
            />
          </div>
          <div v-if="selectedLog.cardio.length">
            <p class="mb-1 text-xs text-gray-400">유산소</p>
            <p v-for="c in selectedLog.cardio" :key="c.id" class="text-sm">
              {{ CARDIO_TYPE_LABELS[c.type] }} {{ c.durationMin }}분
              <span v-if="c.distanceKm" class="text-gray-400">· {{ c.distanceKm }}km</span>
            </p>
          </div>
          <div v-if="selectedLog.meals.length" class="space-y-3">
            <MealGroupedList :meals="selectedLog.meals" readonly />
            <MacroSummary :totals="sumMacros(selectedLog.meals)" />
          </div>
          <p v-if="isSelectedLogEmpty" class="py-2 text-center text-sm text-gray-400">
            기록 없음 — 수정 버튼으로 기록을 추가할 수 있어요
          </p>
        </template>

        <template v-else>
          <div class="space-y-2">
            <WorkoutCard
              v-for="(w, i) in selectedLog.workouts"
              :key="w.id"
              :workout="w"
              :date="selectedDate"
              :can-move-up="i > 0"
              :can-move-down="i < selectedLog.workouts.length - 1"
              @update="(v) => update((d) => { d.workouts[i] = v })"
              @remove="() => update((d) => d.workouts.splice(i, 1), true)"
              @move-up="moveWorkout(i, -1)"
              @move-down="moveWorkout(i, 1)"
            />
            <button type="button" class="btn-dashed-primary" @click="showPicker = true">
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
            <button type="button" class="btn-dashed" @click="addCardio">
              + 유산소
            </button>
          </div>
          <MealGroupedList
            :meals="selectedLog.meals"
            :date="selectedDate ?? undefined"
            @update="(i, v) => update((d) => { d.meals[i] = v })"
            @remove="(i) => update((d) => d.meals.splice(i, 1), true)"
            @manual-add="addMeal"
          />
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
