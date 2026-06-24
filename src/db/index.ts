import Dexie, { type EntityTable } from 'dexie'
import type { AppSettings, CustomExercise, DayLog } from '@/types/log'
import { DEFAULT_SETTINGS } from '@/types/log'

export class ChotohwaDB extends Dexie {
  dayLogs!: EntityTable<DayLog, 'date'>
  customExercises!: EntityTable<CustomExercise, 'id'>
  settings!: EntityTable<AppSettings, 'id'>

  constructor() {
    super('chotohwa')

    this.version(1).stores({
      dayLogs: 'date, updatedAt',
      customExercises: 'id, name, category',
      settings: 'id',
    })
  }
}

export const db = new ChotohwaDB()

export function createEmptyDayLog(date: string): DayLog {
  return {
    date,
    workouts: [],
    cardio: [],
    meals: [],
    updatedAt: new Date().toISOString(),
  }
}

export async function getDayLog(date: string): Promise<DayLog> {
  const existing = await db.dayLogs.get(date)
  if (existing) return existing
  return createEmptyDayLog(date)
}

export async function saveDayLog(log: DayLog): Promise<void> {
  if (!log.date) {
    throw new Error('DayLog.date is required')
  }
  const plain = JSON.parse(JSON.stringify(log)) as DayLog
  await db.dayLogs.put({
    ...plain,
    updatedAt: new Date().toISOString(),
  })
}

export async function getSettings(): Promise<AppSettings> {
  const settings = await db.settings.get('app')
  return settings ?? { ...DEFAULT_SETTINGS }
}

export async function saveSettings(settings: AppSettings): Promise<void> {
  const plain = JSON.parse(JSON.stringify(settings)) as AppSettings
  await db.settings.put(plain)
}

export async function getCustomExercises(): Promise<CustomExercise[]> {
  return db.customExercises.toArray()
}

export async function addCustomExercise(exercise: CustomExercise): Promise<void> {
  await db.customExercises.put(exercise)
}

export async function getDayLogsInRange(from: string, to: string): Promise<DayLog[]> {
  return db.dayLogs.where('date').between(from, to, true, true).toArray()
}

export async function getAllDayLogs(): Promise<DayLog[]> {
  return db.dayLogs.orderBy('date').toArray()
}

export async function getDatesWithLogs(): Promise<string[]> {
  const logs = await db.dayLogs.toArray()
  return logs
    .filter((log) => log.workouts.length > 0 || log.cardio.length > 0 || log.meals.length > 0)
    .map((log) => log.date)
}

export async function findRecentWorkoutSets(
  exerciseId: string,
  beforeDate: string,
  limit = 1,
): Promise<{ date: string; sets: { weightKg: number; reps: number }[] }[]> {
  const logs = await db.dayLogs
    .where('date')
    .below(beforeDate)
    .reverse()
    .toArray()

  const results: { date: string; sets: { weightKg: number; reps: number }[] }[] = []

  for (const log of logs) {
    const workout = log.workouts.find((w) => w.exerciseId === exerciseId)
    if (workout && workout.sets.length > 0) {
      results.push({ date: log.date, sets: workout.sets })
      if (results.length >= limit) break
    }
  }

  return results
}
