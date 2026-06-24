<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { getWeeklyMealInsights, MEAL_TYPE_LABELS, type WeeklyMealInsights } from '@/services/insights/mealStats'

const insights = ref<WeeklyMealInsights | null>(null)
const expandedDay = ref<string | null>(null)

const maxCalories = computed(() => {
  if (!insights.value) return 1
  return Math.max(...insights.value.dailySummaries.map((d) => d.calories), 1)
})

onMounted(async () => {
  insights.value = await getWeeklyMealInsights(7)
})

function toggleDay(date: string) {
  expandedDay.value = expandedDay.value === date ? null : date
}
</script>

<template>
  <div v-if="insights && insights.mealDays > 0" class="rounded-xl bg-white border border-gray-200 p-4 space-y-4">
    <div>
      <h3 class="text-sm font-medium text-gray-700">이번 주 식단</h3>
      <p class="text-xs text-gray-400 mt-0.5">
        {{ insights.mealDays }}일 기록 · 음식 {{ insights.totalUniqueFoods }}종
      </p>
    </div>

    <div class="grid grid-cols-3 gap-2 text-center text-sm">
      <div class="rounded-lg bg-gray-100 py-2">
        <p class="font-bold">{{ insights.avgCalories }}</p>
        <p class="text-xs text-gray-400">평균 kcal</p>
      </div>
      <div class="rounded-lg bg-gray-100 py-2">
        <p class="font-bold">{{ insights.avgProteinG }}g</p>
        <p class="text-xs text-gray-400">평균 단백</p>
      </div>
      <div class="rounded-lg bg-gray-100 py-2">
        <p class="font-bold">{{ insights.mealDays }}/7</p>
        <p class="text-xs text-gray-400">기록일</p>
      </div>
    </div>

    <!-- 일별 칼로리 바 -->
    <div>
      <p class="text-xs text-gray-400 mb-2">일별 칼로리</p>
      <div class="flex items-end gap-1 h-20">
        <button
          v-for="day in insights.dailySummaries"
          :key="day.date"
          type="button"
          class="flex flex-1 flex-col items-center gap-1 min-w-0"
          @click="toggleDay(day.date)"
        >
          <div class="w-full flex items-end justify-center h-14">
            <div
              class="w-full max-w-[28px] rounded-t bg-primary-500 transition-all"
              :class="expandedDay === day.date ? 'bg-primary-600' : ''"
              :style="{ height: `${Math.max(8, (day.calories / maxCalories) * 100)}%` }"
            />
          </div>
          <span class="text-[10px] text-gray-400 truncate w-full text-center">
            {{ day.dayLabel.split(' ')[0] }}
          </span>
        </button>
      </div>
    </div>

    <!-- 선택한 날 상세 -->
    <div
      v-if="expandedDay"
      class="rounded-lg bg-gray-100 p-3 space-y-1"
    >
      <template v-for="day in insights.dailySummaries" :key="day.date">
        <div v-if="day.date === expandedDay">
          <p class="text-xs font-medium text-gray-600 mb-2">
            {{ day.dayLabel }} — {{ day.calories }}kcal (단{{ Math.round(day.proteinG) }}g)
          </p>
          <p
            v-for="meal in day.meals"
            :key="meal.id"
            class="text-sm text-gray-700"
          >
            <span class="text-gray-400 text-xs">[{{ MEAL_TYPE_LABELS[meal.mealType] }}]</span>
            {{ meal.name || '(이름 없음)' }} — {{ meal.calories }}kcal
          </p>
        </div>
      </template>
    </div>

    <!-- 자주 먹은 음식 -->
    <div v-if="insights.topFoods.length">
      <p class="text-xs text-gray-400 mb-2">자주 먹은 음식</p>
      <div class="space-y-2">
        <div
          v-for="food in insights.topFoods"
          :key="food.name"
          class="flex items-center justify-between text-sm"
        >
          <div class="flex items-center gap-2 min-w-0">
            <span class="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
              {{ food.count }}회
            </span>
            <span class="truncate text-gray-800">{{ food.name }}</span>
          </div>
          <span class="shrink-0 text-xs text-gray-400">
            {{ food.totalCalories }}kcal
          </span>
        </div>
      </div>
    </div>
  </div>

  <div
    v-else-if="insights"
    class="rounded-xl bg-white border border-gray-200 p-4 text-sm text-gray-400 text-center"
  >
    이번 주 식단 기록이 없습니다
  </div>
</template>
