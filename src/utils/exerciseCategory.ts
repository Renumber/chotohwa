import { EXERCISE_PRESETS } from '@/data/exercisePresets'
import type { CustomExercise, ExerciseCategory } from '@/types/log'

const presetMap = new Map(EXERCISE_PRESETS.map((e) => [e.id, e.category]))

export function getExerciseCategory(
  exerciseId: string,
  customExercises: CustomExercise[] = [],
): ExerciseCategory | null {
  const preset = presetMap.get(exerciseId)
  if (preset) return preset
  return customExercises.find((e) => e.id === exerciseId)?.category ?? null
}
