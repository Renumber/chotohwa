import type { MealEntry, MealType } from '@/types/log'
import { MEAL_TYPE_LABELS } from '@/types/log'
import { sumMacros } from '@/utils/helpers'

export const MEAL_ORDER: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack']

export interface MealGroupItem {
  entry: MealEntry
  index: number
}

export interface MealGroup {
  type: MealType
  label: string
  items: MealGroupItem[]
  subtotal: ReturnType<typeof sumMacros>
}

export function groupMealsByType(meals: MealEntry[]): MealGroup[] {
  const buckets = new Map<MealType, MealGroupItem[]>()
  for (const type of MEAL_ORDER) buckets.set(type, [])

  meals.forEach((entry, index) => {
    buckets.get(entry.mealType)?.push({ entry, index })
  })

  return MEAL_ORDER.map((type) => {
    const items = buckets.get(type) ?? []
    return {
      type,
      label: MEAL_TYPE_LABELS[type],
      items,
      subtotal: sumMacros(items.map((i) => i.entry)),
    }
  })
}
