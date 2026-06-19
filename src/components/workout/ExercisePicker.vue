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
const customExercises = ref<{ id: string; name: string; category: ExerciseCategory }[]>([])
const showAdd = ref(false)
const newName = ref('')
const newCategory = ref<ExerciseCategory>('chest')

const filtered = computed(() => {
  const presets = EXERCISE_PRESETS.filter(
    (e) => category.value === 'all' || e.category === category.value,
  )
  const custom = customExercises.value.filter(
    (e) => category.value === 'all' || e.category === category.value,
  )
  return [...presets, ...custom]
})

async function loadCustom() {
  customExercises.value = await getCustomExercises()
}

watch(() => props.open, (isOpen) => {
  if (isOpen) void loadCustom()
})
async function addCustom() {
  if (!newName.value.trim()) return
  const exercise = {
    id: `custom-${generateId()}`,
    name: newName.value.trim(),
    category: newCategory.value,
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
      <div class="flex flex-wrap gap-2">
        <button
          v-for="(label, key) in { all: '전체', ...CATEGORY_LABELS }"
          :key="key"
          type="button"
          class="rounded-full px-3 py-1 text-xs"
          :class="
            category === key
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-600'
          "
          @click="category = key as ExerciseCategory | 'all'"
        >
          {{ label }}
        </button>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="exercise in filtered"
          :key="exercise.id"
          type="button"
          class="rounded-xl border border-gray-200 bg-gray-100 px-3 py-3 text-left text-sm hover:border-primary-500"
          @click="emit('select', exercise.id, exercise.name); emit('close')"
        >
          {{ exercise.name }}
        </button>
      </div>

      <div v-if="!showAdd">
        <button
          type="button"
          class="w-full rounded-xl border border-dashed border-gray-300 py-3 text-sm text-gray-500"
          @click="showAdd = true"
        >
          + 직접 추가
        </button>
      </div>
      <div v-else class="space-y-2 rounded-xl bg-gray-100 p-3">
        <input
          v-model="newName"
          type="text"
          placeholder="운동 이름"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <select
          v-model="newCategory"
          class="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
        >
          <option v-for="(label, key) in CATEGORY_LABELS" :key="key" :value="key">
            {{ label }}
          </option>
        </select>
        <button
          type="button"
          class="w-full rounded-lg bg-primary-600 py-2 text-sm text-white"
          @click="addCustom"
        >
          추가하고 선택
        </button>
      </div>
    </div>
  </Modal>
</template>
