export type FoodUnit = 'g' | 'count' | 'bag' | 'bowl'

export interface FoodPreset {
  id: string
  name: string
  unit: FoodUnit
  unitLabel: string
  /** g 단위는 100g 기준, 나머지는 1단위 기준 */
  caloriesPerUnit: number
  carbsGPerUnit: number
  proteinGPerUnit: number
  fatGPerUnit: number
}

export const FOOD_PRESETS: FoodPreset[] = [
  {
    id: 'chicken-breast',
    name: '닭가슴살',
    unit: 'g',
    unitLabel: 'g',
    caloriesPerUnit: 165,
    carbsGPerUnit: 0,
    proteinGPerUnit: 31,
    fatGPerUnit: 3.6,
  },
  {
    id: 'mixed-nuts',
    name: '견과류',
    unit: 'bag',
    unitLabel: '봉지',
    caloriesPerUnit: 180,
    carbsGPerUnit: 6,
    proteinGPerUnit: 5,
    fatGPerUnit: 16,
  },
  {
    id: 'sweet-potato',
    name: '고구마',
    unit: 'g',
    unitLabel: 'g',
    caloriesPerUnit: 86,
    carbsGPerUnit: 20,
    proteinGPerUnit: 1.6,
    fatGPerUnit: 0.1,
  },
  {
    id: 'cherry-tomato',
    name: '방울토마토',
    unit: 'count',
    unitLabel: '개',
    caloriesPerUnit: 3,
    carbsGPerUnit: 0.5,
    proteinGPerUnit: 0.1,
    fatGPerUnit: 0,
  },
  {
    id: 'egg',
    name: '계란',
    unit: 'count',
    unitLabel: '개',
    caloriesPerUnit: 72,
    carbsGPerUnit: 0.4,
    proteinGPerUnit: 6.3,
    fatGPerUnit: 5,
  },
  {
    id: 'white-rice',
    name: '밥',
    unit: 'bowl',
    unitLabel: '공기',
    caloriesPerUnit: 310,
    carbsGPerUnit: 68,
    proteinGPerUnit: 5.5,
    fatGPerUnit: 0.5,
  },
  {
    id: 'brown-rice',
    name: '현미밥',
    unit: 'bowl',
    unitLabel: '공기',
    caloriesPerUnit: 330,
    carbsGPerUnit: 72,
    proteinGPerUnit: 6,
    fatGPerUnit: 1,
  },
]

export function calcFoodMacros(preset: FoodPreset, quantity: number) {
  const factor = preset.unit === 'g' ? quantity / 100 : quantity
  return {
    calories: Math.round(preset.caloriesPerUnit * factor),
    carbsG: Math.round(preset.carbsGPerUnit * factor * 10) / 10,
    proteinG: Math.round(preset.proteinGPerUnit * factor * 10) / 10,
    fatG: Math.round(preset.fatGPerUnit * factor * 10) / 10,
  }
}
