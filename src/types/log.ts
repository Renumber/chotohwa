export type CardioType = 'running' | 'cycling' | 'walking' | 'other'

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack'

export type FitnessGoal = 'lean_bulk' | 'cut' | 'maintain'

export interface WorkoutSet {
  weightKg: number
  reps: number
}

export interface WorkoutEntry {
  id: string
  exerciseId: string
  exerciseName: string
  sets: WorkoutSet[]
  note?: string
}

export interface CardioEntry {
  id: string
  type: CardioType
  durationMin: number
  distanceKm?: number
  calories?: number
}

export interface MealEntry {
  id: string
  name: string
  calories: number
  carbsG: number
  proteinG: number
  fatG: number
  mealType: MealType
}

export interface DayLog {
  date: string
  workouts: WorkoutEntry[]
  cardio: CardioEntry[]
  meals: MealEntry[]
  updatedAt: string
}

export interface CustomExercise {
  id: string
  name: string
  category: ExerciseCategory
}

export type ExerciseCategory =
  | 'chest'
  | 'back'
  | 'legs'
  | 'shoulders'
  | 'arms'
  | 'core'

export interface ExercisePreset {
  id: string
  name: string
  category: ExerciseCategory
}

export interface DailyTargets {
  calories?: number
  proteinG?: number
  carbsG?: number
  fatG?: number
}

export type AIProviderType = 'mock' | 'openai' | 'claude'

export interface AppSettings {
  id: 'app'
  goal: FitnessGoal
  dailyTargets: DailyTargets
  aiProvider: AIProviderType
  openaiApiKey?: string
  claudeApiKey?: string
  customPrompt?: string
}

export interface MacroTotals {
  calories: number
  carbsG: number
  proteinG: number
  fatG: number
}

export interface DayLogSummary {
  date: string
  workouts: {
    name: string
    sets: string
    note?: string
  }[]
  cardio: {
    type: string
    durationMin: number
    distanceKm?: number
    calories?: number
  }[]
  meals: {
    name: string
    mealType: MealType
    calories: number
    carbsG: number
    proteinG: number
    fatG: number
  }[]
  totals: MacroTotals
  hasWorkout: boolean
}

export interface WeeklyStats {
  totalDays: number
  workoutDays: number
  avgCalories: number
  avgProteinG: number
  avgCarbsG: number
  avgFatG: number
  totalCardioMin: number
  exerciseFrequency: Record<string, number>
}

export interface CoachContext {
  meta: {
    app: 'chotohwa'
    schemaVersion: 1
    exportedAt: string
    period: { from: string; to: string; days: number }
  }
  profile: {
    goal: FitnessGoal
    dailyTargets?: DailyTargets
  }
  summary: WeeklyStats
  dailyLogs: DayLogSummary[]
}

export interface BackupFile {
  version: 1
  exportedAt: string
  dayLogs: DayLog[]
  customExercises: CustomExercise[]
  settings: AppSettings
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'app',
  goal: 'maintain',
  dailyTargets: {},
  aiProvider: 'mock',
}

export const MEAL_TYPE_LABELS: Record<MealType, string> = {
  breakfast: '아침',
  lunch: '점심',
  dinner: '저녁',
  snack: '간식',
}

export const CARDIO_TYPE_LABELS: Record<CardioType, string> = {
  running: '달리기',
  cycling: '자전거',
  walking: '걷기',
  other: '기타',
}

export const GOAL_LABELS: Record<FitnessGoal, string> = {
  lean_bulk: '린메스업',
  cut: '컷팅',
  maintain: '유지',
}

export const CATEGORY_LABELS: Record<ExerciseCategory, string> = {
  chest: '가슴',
  back: '등',
  legs: '하체',
  shoulders: '어깨',
  arms: '팔',
  core: '코어',
}
