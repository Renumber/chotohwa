<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { EXERCISE_PRESETS } from '@/data/exercisePresets'
import { CATEGORY_LABELS, type ExerciseCategory } from '@/types/log'
import { getCustomExercises, addCustomExercise } from '@/db'
import { generateId } from '@/utils/helpers'
import Modal from '@/components/common/Modal.vue'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  close: []
  select: [exerciseId: string, exerciseName: string]
}>()

const category = ref<ExerciseCategory | 'all'>('all')
const searchQuery = ref('')
const customExercises = ref<{ id: string; name: string; category: ExerciseCategory }[]>([])
const showAdd = ref(false)
const newName = ref('')
const newCategory = ref<ExerciseCategory>('chest')

const filtered = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  return [...EXERCISE_PRESETS, ...customExercises.value].filter(
    (e) =>
      (category.value === 'all' || e.category === category.value)
      && (!q || e.name.toLowerCase().includes(q)),
  )
})

async function loadCustom() {
  customExercises.value = await getCustomExercises()
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    searchQuery.value = ''
    void loadCustom()
  }
})

watch(category, (cat) => {
  if (cat !== 'all') newCategory.value = cat
})

function openAddForm() {
  if (category.value !== 'all') newCategory.value = category.value
  showAdd.value = true
}

async function addCustom() {
  if (!newName.value.trim()) return
  const exerciseCategory = category.value !== 'all' ? category.value : newCategory.value
  const exercise = {
    id: `custom-${generateId()}`,
    name: newName.value.trim(),
    category: exerciseCategory,
  }
  await addCustomExercise(exercise)
  customExercises.value.push(exercise)
  newName.value = ''
  showAdd.value = false
  emit('select', exercise.id, exercise.name)
  emit('close')
}
</script>

<template>
  <Modal :open="open" title="운동 선택" @close="emit('close')">
    <div v-if="open" class="space-y-4">
      <input
        v-model="searchQuery"
        type="search"
        placeholder="운동 검색"
        class="input"
      />

      <div class="flex flex-wrap gap-2">
        <button
          v-for="(label, key) in { all: '전체', ...CATEGORY_LABELS }"
          :key="key"
          type="button"
          :class="category === key ? 'chip-active' : 'chip-inactive'"
          @click="category = key as ExerciseCategory | 'all'"
        >
          {{ label }}
        </button>
      </div>

      <p v-if="!filtered.length" class="py-4 text-center text-sm text-gray-400">
        검색 결과가 없어요
      </p>
      <div v-else class="grid grid-cols-2 gap-2">
        <button
          v-for="exercise in filtered"
          :key="exercise.id"
          type="button"
          class="rounded-xl border border-gray-200 bg-gray-100 px-3 py-3 text-left text-sm transition-colors hover:border-primary-500 hover:bg-primary-50"
          @click="emit('select', exercise.id, exercise.name); emit('close')"
        >
          {{ exercise.name }}
        </button>
      </div>

      <div v-if="!showAdd">
        <button type="button" class="btn-dashed py-3" @click="openAddForm">
          + 직접 추가
        </button>
      </div>
      <div v-else class="space-y-2 rounded-xl bg-gray-100 p-3">
        <input
          v-model="newName"
          type="text"
          placeholder="운동 이름"
          class="input"
          @keyup.enter="addCustom"
        />
        <select
          v-if="category === 'all'"
          v-model="newCategory"
          class="input"
        >
          <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <p v-else class="text-xs text-gray-500">
          카테고리: {{ CATEGORY_LABELS[category] }}
        </p>
        <button
          type="button"
          class="btn-primary w-full py-2"
          :disabled="!newName.trim()"
          @click="addCustom"
        >
          추가하고 선택
        </button>
      </div>
    </div>
  </Modal>
</template>
