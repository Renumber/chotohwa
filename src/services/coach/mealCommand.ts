import { FOOD_PRESETS, calcFoodMacros, type FoodPreset } from '@/data/foodPresets'
import type { MealEntry, MealType } from '@/types/log'
import { generateId } from '@/utils/helpers'

export interface ParsedMealCommand {
  mealType: MealType
  entries: MealEntry[]
}

const MEAL_ACTION_RE = /먹었|먹음|먹었다|먹었어|먹었어요|섭취했|식사했|식단에\s*(?:추가|기록)|식사에\s*(?:추가|기록)|먹은\s*(?:거|것).*기록/
const QUANTITY_RE = /(\d+(?:\.\d+)?|하나|한|둘|두|셋|세|넷|네|다섯|여섯|일곱|여덟|아홉|반)\s*(킬로그램|킬로|kg|그램|g|인분|봉지|공기|그릇|스쿱|스푼|조각|병|캔|팩|컵|개|알)/i
const QUANTITY_CONNECTOR_RE = /(킬로그램|킬로|kg|그램|g|인분|봉지|공기|그릇|스쿱|스푼|조각|병|캔|팩|컵|개|알)(?:이랑|랑|과|와|하고)\s+/gi

const KOREAN_NUMBERS: Record<string, number> = {
  한: 1,
  하나: 1,
  두: 2,
  둘: 2,
  세: 3,
  셋: 3,
  네: 4,
  넷: 4,
  다섯: 5,
  여섯: 6,
  일곱: 7,
  여덟: 8,
  아홉: 9,
  반: 0.5,
}

const FOOD_ALIASES: Record<string, string[]> = {
  'chicken-breast': ['닭 가슴살'],
  egg: ['달걀', '삶은 계란', '삶은 달걀'],
  'white-rice': ['흰밥', '쌀밥', '백미밥'],
  'brown-rice': ['현미 밥'],
  'mixed-nuts': ['믹스넛', '아몬드'],
  'sweet-potato': ['군고구마', '찐고구마'],
  'cherry-tomato': ['방울 토마토'],
}

const GRAMS_PER_UNIT: Partial<Record<string, number>> = {
  'white-rice': 210,
  'brown-rice': 210,
  'mixed-nuts': 25,
  egg: 50,
  'cherry-tomato': 15,
}

function inferMealType(text: string, hour = new Date().getHours()): MealType {
  if (/아침|조식/.test(text)) return 'breakfast'
  if (/점심|중식/.test(text)) return 'lunch'
  if (/저녁|석식/.test(text)) return 'dinner'
  if (/간식|야식/.test(text)) return 'snack'
  if (hour < 11) return 'breakfast'
  if (hour < 16) return 'lunch'
  if (hour < 22) return 'dinner'
  return 'snack'
}

function parseQuantity(raw: string): number {
  return Number(raw) || KOREAN_NUMBERS[raw] || 0
}

function normalizeUnit(unit: string): string {
  if (/kg|킬로/.test(unit)) return 'kg'
  if (/g|그램/i.test(unit)) return 'g'
  if (unit === '알') return '개'
  if (unit === '팩') return '봉지'
  return unit
}

function findPreset(foodName: string): FoodPreset | undefined {
  const candidates = FOOD_PRESETS.flatMap((preset) => (
    [preset.name, ...(FOOD_ALIASES[preset.id] ?? [])].map((alias) => ({ alias, preset }))
  )).sort((a, b) => b.alias.length - a.alias.length)
  return candidates.find(({ alias }) => foodName.includes(alias))?.preset
}

function nativeQuantity(preset: FoodPreset, quantity: number, unit: string): number | null {
  const normalized = normalizeUnit(unit)
  const grams = normalized === 'kg' ? quantity * 1000 : normalized === 'g' ? quantity : null

  if (preset.unit === 'g') return grams
  if (grams !== null) {
    const gramsPerUnit = GRAMS_PER_UNIT[preset.id]
    return gramsPerUnit ? grams / gramsPerUnit : null
  }
  if (preset.unit === 'count' && ['개'].includes(normalized)) return quantity
  if (preset.unit === 'bag' && normalized === '봉지') return quantity
  if (preset.unit === 'bowl' && ['공기', '그릇'].includes(normalized)) return quantity
  return null
}

function cleanFoodName(value: string): string {
  return value
    .replace(/^(?:오늘\s*)?(?:아침|점심|저녁|간식|야식|조식|중식|석식)(?:으로|에|에는|은|는)?\s*/g, '')
    .replace(/^(?:으로|에)\s+/, '')
    .replace(/^오늘\s+/, '')
    .replace(/^(?:먹은|먹었던)\s+/, '')
    .replace(/(?:을|를|은|는)$/, '')
    .replace(/^(?:내가|저는|나는)\s+/, '')
    .trim()
}

function createEntry(foodName: string, quantity: number, unit: string, mealType: MealType): MealEntry {
  const preset = findPreset(foodName)
  const displayUnit = normalizeUnit(unit)
  const displayName = `${preset?.name ?? foodName} (${quantity}${displayUnit})`
  const presetQuantity = preset ? nativeQuantity(preset, quantity, unit) : null
  const macros = preset && presetQuantity !== null
    ? calcFoodMacros(preset, presetQuantity)
    : { calories: 0, carbsG: 0, proteinG: 0, fatG: 0 }

  return {
    id: generateId(),
    name: displayName,
    mealType,
    ...macros,
  }
}

/** 먹은 음식과 수량을 말한 문장만 식사 기록 명령으로 해석한다. */
export function parseMealCommand(text: string): ParsedMealCommand | null {
  if (!MEAL_ACTION_RE.test(text)) return null

  const mealType = inferMealType(text)
  const entries: MealEntry[] = []
  const parts = text
    .replace(/[.!?]/g, '')
    .replace(QUANTITY_CONNECTOR_RE, '$1,')
    .split(/,\s*|\s+(?:그리고|하고|및|와|과)\s+|(?:이랑|랑)\s+/)

  for (const part of parts) {
    const match = QUANTITY_RE.exec(part)
    if (!match || match.index === 0) continue
    const quantity = parseQuantity(match[1])
    const foodName = cleanFoodName(part.slice(0, match.index))
    if (!foodName || quantity <= 0) continue
    entries.push(createEntry(foodName, quantity, match[2], mealType))
  }

  return { mealType, entries }
}
