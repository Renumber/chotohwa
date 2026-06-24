import { getDayLogsInRange } from '@/db'
import { MEAL_TYPE_LABELS, type DayLog, type MealEntry } from '@/types/log'
import { sumMacros, formatDateKey } from '@/utils/helpers'
import { subDays, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export interface DailyMealSummary {
  date: string
  dayLabel: string
  calories: number
  proteinG: number
  carbsG: number
  fatG: number
  mealCount: number
  meals: MealEntry[]
}

export interface FoodFrequency {
  name: string
  count: number
  totalCalories: number
  totalProteinG: number
}

export interface WeeklyMealInsights {
  from: string
  to: string
  dailySummaries: DailyMealSummary[]
  topFoods: FoodFrequency[]
  mealDays: number
  avgCalories: number
  avgProteinG: number
  totalUniqueFoods: number
}

function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase()
}

export function buildWeeklyMealInsights(logs: DayLog[]): WeeklyMealInsights {
  const dailySummaries: DailyMealSummary[] = logs
    .filter((l) => l.meals.length > 0)
    .map((log) => {
      const totals = sumMacros(log.meals)
      return {
        date: log.date,
        dayLabel: format(new Date(log.date), 'M/d (EEE)', { locale: ko }),
        calories: totals.calories,
        proteinG: totals.proteinG,
        carbsG: totals.carbsG,
        fatG: totals.fatG,
        mealCount: log.meals.length,
        meals: log.meals,
      }
    })

  const foodMap = new Map<string, FoodFrequency>()

  for (const log of logs) {
    for (const meal of log.meals) {
      if (!meal.name.trim()) continue
      const key = normalizeFoodName(meal.name)
      const existing = foodMap.get(key)
      if (existing) {
        existing.count += 1
        existing.totalCalories += meal.calories
        existing.totalProteinG += meal.proteinG
      } else {
        foodMap.set(key, {
          name: meal.name.trim(),
          count: 1,
          totalCalories: meal.calories,
          totalProteinG: meal.proteinG,
        })
      }
    }
  }

  const topFoods = [...foodMap.values()]
    .sort((a, b) => b.count - a.count || b.totalCalories - a.totalCalories)
    .slice(0, 8)

  const mealDays = dailySummaries.length
  const avgCalories =
    mealDays > 0
      ? Math.round(dailySummaries.reduce((s, d) => s + d.calories, 0) / mealDays)
      : 0
  const avgProteinG =
    mealDays > 0
      ? Math.round(dailySummaries.reduce((s, d) => s + d.proteinG, 0) / mealDays)
      : 0

  return {
    from: logs[0]?.date ?? formatDateKey(new Date()),
    to: logs[logs.length - 1]?.date ?? formatDateKey(new Date()),
    dailySummaries,
    topFoods,
    mealDays,
    avgCalories,
    avgProteinG,
    totalUniqueFoods: foodMap.size,
  }
}

export async function getWeeklyMealInsights(days = 7): Promise<WeeklyMealInsights> {
  const today = new Date()
  const to = formatDateKey(today)
  const from = formatDateKey(subDays(today, days - 1))
  const logs = await getDayLogsInRange(from, to)
  return buildWeeklyMealInsights(logs)
}

export { MEAL_TYPE_LABELS }
