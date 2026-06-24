import { getCustomExercises, getDayLogsInRange } from '@/db'
import {
  CATEGORY_LABELS,
  type CustomExercise,
  type DayLog,
  type ExerciseCategory,
  type WorkoutEntry,
  type WorkoutSet,
} from '@/types/log'
import { getExerciseCategory } from '@/utils/exerciseCategory'
import { subDays, format } from 'date-fns'
import { ko } from 'date-fns/locale'

export function calcVolume(sets: WorkoutSet[]): number {
  return sets.reduce((sum, s) => sum + s.weightKg * s.reps, 0)
}

export function calcMaxWeight(sets: WorkoutSet[]): number {
  if (sets.length === 0) return 0
  return Math.max(...sets.map((s) => s.weightKg))
}

/** 가장 무거운 무게 세트. 동무게면 횟수 많은 쪽 */
export function getHeaviestSet(sets: WorkoutSet[]): WorkoutSet | null {
  if (sets.length === 0) return null
  return sets.reduce((best, s) => {
    if (s.weightKg > best.weightKg) return s
    if (s.weightKg === best.weightKg && s.reps > best.reps) return s
    return best
  })
}

export function formatSetLabel(set: WorkoutSet): string {
  return `${set.weightKg}kg×${set.reps}`
}

export interface HeaviestSetComparison {
  current: WorkoutSet
  last: WorkoutSet | null
  weightDelta: number | null
  repsDelta: number | null
}

export function compareHeaviestSets(
  currentSets: WorkoutSet[],
  lastSets: WorkoutSet[] | null | undefined,
): HeaviestSetComparison | null {
  const current = getHeaviestSet(currentSets)
  if (!current) return null
  const last = lastSets ? getHeaviestSet(lastSets) : null
  return {
    current,
    last,
    weightDelta: last ? current.weightKg - last.weightKg : null,
    repsDelta: last ? current.reps - last.reps : null,
  }
}

export function calcTotalReps(sets: WorkoutSet[]): number {
  return sets.reduce((sum, s) => sum + s.reps, 0)
}

export interface ExerciseComparison {
  exerciseId: string
  exerciseName: string
  currentHeaviest: WorkoutSet
  lastHeaviest: WorkoutSet | null
  weightDelta: number | null
  repsDelta: number | null
  currentVolume: number
  lastVolume: number | null
  volumeDelta: number | null
}

export interface CategoryComparison {
  category: ExerciseCategory
  categoryLabel: string
  lastDate: string | null
  lastDateLabel: string | null
  currentSetCount: number
  lastSetCount: number
  currentVolume: number
  lastVolume: number
  volumeDelta: number
  volumeDeltaPercent: number | null
  exerciseComparisons: ExerciseComparison[]
}

function workoutsForCategory(
  workouts: WorkoutEntry[],
  category: ExerciseCategory,
  customExercises: CustomExercise[],
): WorkoutEntry[] {
  return workouts.filter((w) => getExerciseCategory(w.exerciseId, customExercises) === category)
}

function categoryVolume(workouts: WorkoutEntry[]): number {
  return workouts.reduce((sum, w) => sum + calcVolume(w.sets), 0)
}

function countSets(workouts: WorkoutEntry[]): number {
  return workouts.reduce((sum, w) => sum + w.sets.length, 0)
}

export async function findLastCategorySession(
  category: ExerciseCategory,
  beforeDate: string,
): Promise<{ date: string; workouts: WorkoutEntry[] } | null> {
  const customExercises = await getCustomExercises()
  const from = format(subDays(new Date(beforeDate), 90), 'yyyy-MM-dd')
  const logs = await getDayLogsInRange(from, beforeDate)
    .then((l) => l.filter((log) => log.date < beforeDate).reverse())

  for (const log of logs) {
    const matched = workoutsForCategory(log.workouts, category, customExercises)
    if (matched.length > 0) {
      return { date: log.date, workouts: matched }
    }
  }
  return null
}

export async function compareCategorySession(
  category: ExerciseCategory,
  currentWorkouts: WorkoutEntry[],
  currentDate: string,
): Promise<CategoryComparison | null> {
  const customExercises = await getCustomExercises()
  const todayWorkouts = workoutsForCategory(currentWorkouts, category, customExercises)
  if (todayWorkouts.length === 0) return null

  const last = await findLastCategorySession(category, currentDate)
  const currentVolume = categoryVolume(todayWorkouts)
  const lastVolume = last ? categoryVolume(last.workouts) : 0
  const volumeDelta = currentVolume - lastVolume
  const volumeDeltaPercent =
    lastVolume > 0 ? Math.round((volumeDelta / lastVolume) * 100) : null

  const exerciseComparisons: ExerciseComparison[] = todayWorkouts
    .map((current) => {
      const lastExercise = last?.workouts.find((w) => w.exerciseId === current.exerciseId)
      const heaviest = compareHeaviestSets(current.sets, lastExercise?.sets)
      if (!heaviest) return null
      const currentVol = calcVolume(current.sets)
      const lastVol = lastExercise ? calcVolume(lastExercise.sets) : null

      return {
        exerciseId: current.exerciseId,
        exerciseName: current.exerciseName,
        currentHeaviest: heaviest.current,
        lastHeaviest: heaviest.last,
        weightDelta: heaviest.weightDelta,
        repsDelta: heaviest.repsDelta,
        currentVolume: currentVol,
        lastVolume: lastVol,
        volumeDelta: lastVol !== null ? currentVol - lastVol : null,
      }
    })
    .filter((ex): ex is ExerciseComparison => ex !== null)

  return {
    category,
    categoryLabel: CATEGORY_LABELS[category],
    lastDate: last?.date ?? null,
    lastDateLabel: last
      ? format(new Date(last.date), 'M/d', { locale: ko })
      : null,
    currentSetCount: countSets(todayWorkouts),
    lastSetCount: last ? countSets(last.workouts) : 0,
    currentVolume,
    lastVolume,
    volumeDelta,
    volumeDeltaPercent,
    exerciseComparisons,
  }
}

export async function getTodayCategoryComparisons(
  log: DayLog,
): Promise<CategoryComparison[]> {
  const customExercises = await getCustomExercises()
  const categories = new Set<ExerciseCategory>()

  for (const w of log.workouts) {
    const cat = getExerciseCategory(w.exerciseId, customExercises)
    if (cat) categories.add(cat)
  }

  const results: CategoryComparison[] = []
  for (const category of categories) {
    const comparison = await compareCategorySession(category, log.workouts, log.date)
    if (comparison) results.push(comparison)
  }

  return results
}

export function formatDelta(value: number, unit = ''): string {
  if (value > 0) return `+${value}${unit}`
  if (value < 0) return `${value}${unit}`
  return `0${unit}`
}

export function deltaColor(value: number): string {
  if (value > 0) return 'text-primary-600'
  if (value < 0) return 'text-red-500'
  return 'text-gray-400'
}
