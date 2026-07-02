<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { MealEntry, MealType } from '@/types/log'
import { MEAL_TYPE_LABELS } from '@/types/log'
import { FOOD_PRESETS, calcFoodMacros, type FoodPreset } from '@/data/foodPresets'
import { findRecentMeals, type RecentMeal } from '@/db'

const props = defineProps<{
  entry: MealEntry
  date?: string
  grouped?: boolean
}>()

const emit = defineEmits<{
  update: [entry: MealEntry]
  remove: []
}>()

const mealTypes = Object.entries(MEAL_TYPE_LABELS) as [MealType, string][]

const MACRO_FIELDS = [
  { key: 'calories', label: 'kcal', inputmode: 'numeric' },
  { key: 'proteinG', label: '단백 (g)', inputmode: 'decimal' },
  { key: 'carbsG', label: '탄수 (g)', inputmode: 'decimal' },
  { key: 'fatG', label: '지방 (g)', inputmode: 'decimal' },
] as const

const showSuggestions = ref(false)
const selectedPreset = ref<FoodPreset | null>(null)
const quantity = ref('')
const nameQuery = ref(props.entry.name)
const recentMeals = ref<RecentMeal[]>([])

const isDraft = computed(() => !props.entry.name.trim() && props.entry.calories === 0)
const expanded = ref(isDraft.value)

watch(() => props.entry.id, () => {
  nameQuery.value = props.entry.name
  selectedPreset.value = null
  quantity.value = ''
  expanded.value = isDraft.value
})

const filteredRecent = computed(() => {
  const q = nameQuery.value.trim().toLowerCase()
  if (!q) return recentMeals.value
  return recentMeals.value.filter((m) => m.name.toLowerCase().includes(q))
})

const filteredPresets = computed(() => {
  const q = nameQuery.value.trim().toLowerCase()
  const recentNames = new Set(filteredRecent.value.map((m) => m.name.toLowerCase()))
  const presets = q
    ? FOOD_PRESETS.filter((p) => p.name.toLowerCase().includes(q))
    : FOOD_PRESETS
  return presets.filter((p) => !recentNames.has(p.name.toLowerCase()))
})

const showDropdown = computed(
  () =>
    showSuggestions.value
    && !selectedPreset.value
    && (filteredRecent.value.length > 0 || filteredPresets.value.length > 0),
)

async function loadRecentMeals() {
  recentMeals.value = await findRecentMeals(props.date)
}

function onNameInput(value: string) {
  nameQuery.value = value
  selectedPreset.value = null
  quantity.value = ''
  showSuggestions.value = true
  expanded.value = true
  emit('update', { ...props.entry, name: value, calories: 0, carbsG: 0, proteinG: 0, fatG: 0 })
}

function selectPreset(preset: FoodPreset) {
  selectedPreset.value = preset
  nameQuery.value = preset.name
  showSuggestions.value = false
  const qty = preset.unit === 'g' ? 100 : 1
  quantity.value = String(qty)
  applyPreset(preset, qty)
}

function selectRecent(recent: RecentMeal) {
  selectedPreset.value = null
  quantity.value = ''
  nameQuery.value = recent.name
  showSuggestions.value = false
  emit('update', {
    ...props.entry,
    name: recent.name,
    calories: recent.calories,
    carbsG: recent.carbsG,
    proteinG: recent.proteinG,
    fatG: recent.fatG,
  })
  expanded.value = false
}

function applyPreset(preset: FoodPreset, qty: number) {
  const macros = calcFoodMacros(preset, qty)
  const unitSuffix = preset.unit === 'g' ? `${qty}g` : `${qty}${preset.unitLabel}`
  emit('update', {
    ...props.entry,
    name: `${preset.name} (${unitSuffix})`,
    ...macros,
  })
  expanded.value = false
}

function onQuantityInput(value: string) {
  quantity.value = value
  const qty = Number(value)
  if (selectedPreset.value && qty > 0) {
    applyPreset(selectedPreset.value, qty)
  }
}

function onNameFocus() {
  showSuggestions.value = true
  void loadRecentMeals()
}

function onNameBlur() {
  window.setTimeout(() => {
    showSuggestions.value = false
  }, 150)
}

function setMealType(value: MealType) {
  emit('update', { ...props.entry, mealType: value })
}

function updateMacro(key: (typeof MACRO_FIELDS)[number]['key'], value: string) {
  emit('update', { ...props.entry, [key]: Number(value) })
}

function openEdit() {
  expanded.value = true
  selectedPreset.value = null
  quantity.value = ''
  nameQuery.value = props.entry.name
}
</script>

<template>
  <div class="card p-3 space-y-3">
    <div class="flex items-center justify-between gap-2">
      <div v-if="!grouped" class="flex flex-wrap gap-1">
        <button
          v-for="[value, label] in mealTypes"
          :key="value"
          type="button"
          :class="entry.mealType === value ? 'chip-active' : 'chip-inactive'"
          @click="setMealType(value)"
        >
          {{ label }}
        </button>
      </div>
      <button
        type="button"
        class="btn-danger-ghost"
        :class="{ 'ml-auto': grouped }"
        @click="emit('remove')"
      >
        삭제
      </button>
    </div>

    <div class="relative">
      <input
        :value="selectedPreset ? entry.name : nameQuery"
        type="text"
        placeholder="음식 이름"
        class="input"
        :readonly="!!selectedPreset"
        @input="onNameInput(($event.target as HTMLInputElement).value)"
        @focus="onNameFocus"
        @blur="onNameBlur"
      />
      <ul
        v-if="showDropdown"
        class="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
      >
        <template v-if="filteredRecent.length">
          <li class="px-3 py-1 text-xs text-gray-400">최근</li>
          <li v-for="recent in filteredRecent" :key="recent.name">
            <button
              type="button"
              class="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-100"
              @mousedown.prevent="selectRecent(recent)"
            >
              <span class="min-w-0 truncate">{{ recent.name }}</span>
              <span class="shrink-0 text-xs text-gray-400">{{ recent.calories }}kcal</span>
            </button>
          </li>
        </template>
        <template v-if="filteredPresets.length">
          <li
            class="px-3 py-1 text-xs text-gray-400"
            :class="{ 'border-t border-gray-100 mt-1 pt-2': filteredRecent.length }"
          >
            기본
          </li>
          <li v-for="preset in filteredPresets" :key="preset.id">
            <button
              type="button"
              class="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-gray-100"
              @mousedown.prevent="selectPreset(preset)"
            >
              <span>{{ preset.name }}</span>
              <span class="text-xs text-gray-400">{{ preset.unitLabel }}</span>
            </button>
          </li>
        </template>
      </ul>
    </div>

    <div v-if="selectedPreset">
      <label class="field-label">수량 ({{ selectedPreset.unitLabel }})</label>
      <input
        :value="quantity"
        type="number"
        inputmode="decimal"
        min="0"
        class="input mt-0.5"
        @input="onQuantityInput(($event.target as HTMLInputElement).value)"
      />
    </div>

    <div
      v-if="!expanded && entry.calories > 0"
      class="flex items-center justify-between rounded-lg bg-gray-100 px-3 py-2"
    >
      <p class="text-xs text-gray-600">
        {{ entry.calories }}kcal · 탄수 {{ entry.carbsG }}g · 단백 {{ entry.proteinG }}g · 지방 {{ entry.fatG }}g
      </p>
      <button
        type="button"
        class="shrink-0 text-xs text-primary-600"
        @click="openEdit"
      >
        수정
      </button>
    </div>

    <div v-else-if="!selectedPreset" class="grid grid-cols-2 gap-2">
      <div v-for="field in MACRO_FIELDS" :key="field.key">
        <label class="field-label">{{ field.label }}</label>
        <input
          :value="entry[field.key]"
          type="number"
          :inputmode="field.inputmode"
          min="0"
          class="input mt-0.5 px-2 py-1.5"
          @input="updateMacro(field.key, ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>
