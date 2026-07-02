<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useSettingsStore } from '@/stores/settings'
import { GOAL_LABELS } from '@/types/log'
import type { FitnessGoal } from '@/types/log'

const settingsStore = useSettingsStore()
const router = useRouter()

const step = ref(0)
const goal = ref<FitnessGoal>('maintain')
const weightInput = ref('')
const calories = ref<number | null>(null)
const proteinG = ref<number | null>(null)

const GOAL_DESCRIPTIONS: Record<FitnessGoal, string> = {
  lean_bulk: '체지방은 최소로, 근육량을 천천히 늘려요',
  cut: '근손실 없이 체지방을 줄여요',
  maintain: '현재 몸 상태와 건강을 유지해요',
}

const weightKg = computed(() => {
  const w = Number(weightInput.value)
  return Number.isFinite(w) && w > 0 ? w : null
})

function roundTo(value: number, unit: number): number {
  return Math.round(value / unit) * unit
}

/** 체중 기반 권장 타겟: 유지 33kcal/kg, 벌크 +300, 컷 -400 / 단백질 1.6g/kg */
function computeTargets() {
  if (weightKg.value) {
    const maintenance = weightKg.value * 33
    const adjusted =
      goal.value === 'lean_bulk' ? maintenance + 300
      : goal.value === 'cut' ? maintenance - 400
      : maintenance
    calories.value = roundTo(adjusted, 50)
    proteinG.value = roundTo(weightKg.value * 1.6, 5)
  } else {
    calories.value = null
    proteinG.value = null
  }
  step.value = 2
}

async function finish(goCoach: boolean) {
  await settingsStore.save({
    goal: goal.value,
    bodyWeightKg: weightKg.value ?? undefined,
    dailyTargets: {
      ...settingsStore.settings.dailyTargets,
      calories: calories.value ?? undefined,
      proteinG: proteinG.value ?? undefined,
    },
    onboarded: true,
  })
  if (goCoach) {
    void router.push('/coach')
  }
}

async function skip() {
  await settingsStore.save({ onboarded: true })
}
</script>

<template>
  <div class="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4">
    <div class="w-full max-w-md rounded-2xl bg-white p-6 space-y-5">
      <!-- 진행 표시 -->
      <div class="flex items-center justify-between">
        <div class="flex gap-1.5">
          <span
            v-for="i in 3"
            :key="i"
            class="h-1.5 w-8 rounded-full transition-colors"
            :class="i - 1 <= step ? 'bg-primary-500' : 'bg-gray-200'"
          />
        </div>
        <button type="button" class="text-xs text-gray-400 hover:text-gray-600" @click="skip">
          건너뛰기
        </button>
      </div>

      <!-- 1단계: 목표 -->
      <template v-if="step === 0">
        <div>
          <h2 class="text-lg font-bold">환영합니다! 💪</h2>
          <p class="mt-1 text-sm text-gray-500">먼저, 지금 목표가 무엇인가요?</p>
        </div>
        <div class="space-y-2">
          <button
            v-for="(label, key) in GOAL_LABELS"
            :key="key"
            type="button"
            class="w-full rounded-xl border p-3.5 text-left transition-colors"
            :class="
              goal === key
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 hover:border-gray-300'
            "
            @click="goal = key as FitnessGoal"
          >
            <p class="font-medium" :class="goal === key ? 'text-primary-700' : 'text-gray-900'">
              {{ label }}
            </p>
            <p class="mt-0.5 text-xs text-gray-500">{{ GOAL_DESCRIPTIONS[key as FitnessGoal] }}</p>
          </button>
        </div>
        <button type="button" class="btn-primary w-full py-3" @click="step = 1">
          다음
        </button>
      </template>

      <!-- 2단계: 몸무게 -->
      <template v-else-if="step === 1">
        <div>
          <h2 class="text-lg font-bold">몸무게를 알려주세요</h2>
          <p class="mt-1 text-sm text-gray-500">
            일일 칼로리·단백질 목표를 자동으로 계산해 드려요. (선택 사항)
          </p>
        </div>
        <div>
          <label class="field-label">몸무게 (kg)</label>
          <input
            v-model="weightInput"
            type="number"
            inputmode="decimal"
            min="0"
            placeholder="예: 70"
            class="input mt-1"
            @keyup.enter="computeTargets"
          />
        </div>
        <div class="flex gap-2">
          <button type="button" class="btn-secondary flex-1 py-3" @click="step = 0">
            이전
          </button>
          <button type="button" class="btn-primary flex-1 py-3" @click="computeTargets">
            {{ weightKg ? '다음' : '입력 없이 다음' }}
          </button>
        </div>
      </template>

      <!-- 3단계: 타겟 확인 -->
      <template v-else>
        <div>
          <h2 class="text-lg font-bold">일일 목표 확인</h2>
          <p class="mt-1 text-sm text-gray-500">
            {{ weightKg ? `${GOAL_LABELS[goal]} 목표 기준으로 계산했어요. 수정할 수 있어요.` : '원하면 직접 입력할 수 있어요. 나중에 설정에서도 변경 가능해요.' }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">일일 칼로리 (kcal)</label>
            <input
              :value="calories ?? ''"
              type="number"
              inputmode="numeric"
              min="0"
              class="input mt-1"
              @input="calories = Number(($event.target as HTMLInputElement).value) || null"
            />
          </div>
          <div>
            <label class="field-label">일일 단백질 (g)</label>
            <input
              :value="proteinG ?? ''"
              type="number"
              inputmode="numeric"
              min="0"
              class="input mt-1"
              @input="proteinG = Number(($event.target as HTMLInputElement).value) || null"
            />
          </div>
        </div>
        <div class="space-y-2">
          <button type="button" class="btn-primary w-full py-3" @click="finish(true)">
            AI 코치와 플랜 세우기
          </button>
          <button type="button" class="btn-secondary w-full py-3" @click="finish(false)">
            바로 기록 시작하기
          </button>
          <button
            type="button"
            class="w-full py-1 text-center text-xs text-gray-400 hover:text-gray-600"
            @click="step = 1"
          >
            이전으로
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
