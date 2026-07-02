import { generateId } from '@/utils/helpers'
import type { WorkoutEntry, CardioEntry, MealEntry, MealType } from '@/types/log'

export function createWorkoutEntry(exerciseId: string, exerciseName: string): WorkoutEntry {
  return {
    id: generateId(),
    exerciseId,
    exerciseName,
    sets: [{ weightKg: 0, reps: 10 }],
  }
}

export function createCardioEntry(): CardioEntry {
  return {
    id: generateId(),
    type: 'running',
    durationMin: 30,
  }
}

export function createMealEntry(mealType: MealType = 'lunch'): MealEntry {
  return {
    id: generateId(),
    name: '',
    calories: 0,
    carbsG: 0,
    proteinG: 0,
    fatG: 0,
    mealType,
  }
}

export function countTotalSets(workouts: WorkoutEntry[]): number {
  return workouts.reduce((sum, w) => sum + w.sets.length, 0)
}
