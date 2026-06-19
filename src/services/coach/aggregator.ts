import { subDays, format } from 'date-fns'
import { getAllDayLogs, getDayLogsInRange, getSettings } from '@/db'
import {
  CARDIO_TYPE_LABELS,
  type CoachContext,
  type DayLog,
  type DayLogSummary,
  type WeeklyStats,
} from '@/types/log'
import { sumMacros } from '@/utils/helpers'

function summarizeDayLog(log: DayLog): DayLogSummary {
  const totals = sumMacros(log.meals)
  return {
    date: log.date,
    workouts: log.workouts.map((w) => ({
      name: w.exerciseName,
      sets: w.sets.map((s) => `${s.weightKg}kg×${s.reps}`).join(', '),
      note: w.note,
    })),
    cardio: log.cardio.map((c) => ({
      type: CARDIO_TYPE_LABELS[c.type],
      durationMin: c.durationMin,
      distanceKm: c.distanceKm,
      calories: c.calories,
    })),
    meals: log.meals.map((m) => ({ ...m })),
    totals,
    hasWorkout: log.workouts.length > 0 || log.cardio.length > 0,
  }
}

function computeWeeklyStats(logs: DayLog[]): WeeklyStats {
  const daysWithMeals = logs.filter((l) => l.meals.length > 0)
  const workoutDays = logs.filter((l) => l.workouts.length > 0 || l.cardio.length > 0).length

  const mealTotals = daysWithMeals.map((l) => sumMacros(l.meals))
  const count = mealTotals.length || 1

  const exerciseFrequency: Record<string, number> = {}
  let totalCardioMin = 0

  for (const log of logs) {
    for (const w of log.workouts) {
      exerciseFrequency[w.exerciseName] = (exerciseFrequency[w.exerciseName] ?? 0) + 1
    }
    for (const c of log.cardio) {
      totalCardioMin += c.durationMin
    }
  }

  return {
    totalDays: logs.length,
    workoutDays,
    avgCalories: mealTotals.reduce((s, m) => s + m.calories, 0) / count,
    avgProteinG: mealTotals.reduce((s, m) => s + m.proteinG, 0) / count,
    avgCarbsG: mealTotals.reduce((s, m) => s + m.carbsG, 0) / count,
    avgFatG: mealTotals.reduce((s, m) => s + m.fatG, 0) / count,
    totalCardioMin,
    exerciseFrequency,
  }
}

export type ExportPeriod = 7 | 30 | 'all'

export async function buildCoachContext(period: ExportPeriod): Promise<CoachContext> {
  const settings = await getSettings()
  const today = new Date()
  const todayStr = format(today, 'yyyy-MM-dd')

  let logs: DayLog[]

  if (period === 'all') {
    logs = await getAllDayLogs()
  } else {
    const from = format(subDays(today, period - 1), 'yyyy-MM-dd')
    logs = await getDayLogsInRange(from, todayStr)
  }

  logs = logs.filter(
    (l) => l.workouts.length > 0 || l.cardio.length > 0 || l.meals.length > 0,
  )

  const from = logs[0]?.date ?? todayStr
  const to = logs[logs.length - 1]?.date ?? todayStr

  return {
    meta: {
      app: 'chotohwa',
      schemaVersion: 1,
      exportedAt: new Date().toISOString(),
      period: { from, to, days: logs.length },
    },
    profile: {
      goal: settings.goal,
      dailyTargets: settings.dailyTargets,
    },
    summary: computeWeeklyStats(logs),
    dailyLogs: logs.map(summarizeDayLog),
  }
}
