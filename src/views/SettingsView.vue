<script setup lang="ts">
import { ref, onMounted } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { useSettingsStore } from '@/stores/settings'
import { useAiExport } from '@/composables/useAiExport'
import { exportBackup, downloadBackup, importBackup, parseBackupFile, type ImportMode } from '@/services/export/backup'
import { GOAL_LABELS } from '@/types/log'
import type { FitnessGoal, AIProviderType } from '@/types/log'

const settingsStore = useSettingsStore()
const { period, format: exportFormat, loading: exportLoading, toast, download, copy } = useAiExport()

const importMode = ref<ImportMode>('merge')
const backupLoading = ref(false)
const message = ref('')
const fileInput = ref<HTMLInputElement | null>(null)
let messageTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  void settingsStore.load()
})

function showMessage(text: string) {
  message.value = text
  if (messageTimer) clearTimeout(messageTimer)
  messageTimer = setTimeout(() => { message.value = '' }, 3000)
}

async function handleBackup() {
  backupLoading.value = true
  try {
    const data = await exportBackup()
    downloadBackup(data)
    showMessage('백업 파일이 다운로드되었습니다.')
  } catch {
    showMessage('백업 실패')
  } finally {
    backupLoading.value = false
  }
}

async function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  try {
    const data = await parseBackupFile(file)
    await importBackup(data, importMode.value)
    showMessage('가져오기 완료')
    await settingsStore.load()
  } catch (err) {
    showMessage(err instanceof Error ? err.message : '가져오기 실패')
  }
  if (fileInput.value) fileInput.value.value = ''
}

function updateGoal(goal: FitnessGoal) {
  void settingsStore.save({ goal })
}

function updateTarget(field: 'calories' | 'proteinG', value: number) {
  void settingsStore.save({
    dailyTargets: { ...settingsStore.settings.dailyTargets, [field]: value || undefined },
  })
}

function updateAiProvider(provider: AIProviderType) {
  void settingsStore.save({ aiProvider: provider })
}

function updateApiKey(field: 'openaiApiKey' | 'claudeApiKey', value: string) {
  void settingsStore.save({ [field]: value })
}
</script>

<template>
  <div>
    <AppHeader title="설정" />

    <div class="space-y-6 p-4 pb-24">
      <Transition
        enter-active-class="transition-opacity duration-150"
        enter-from-class="opacity-0"
        leave-active-class="transition-opacity duration-300"
        leave-to-class="opacity-0"
      >
        <p
          v-if="message || toast"
          class="rounded-lg bg-primary-50 border border-primary-100 px-3 py-2 text-sm text-primary-700"
        >
          {{ message || toast }}
        </p>
      </Transition>

      <!-- 목표 -->
      <section class="card p-4 space-y-3">
        <h2 class="font-medium">목표</h2>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="(label, key) in GOAL_LABELS"
            :key="key"
            type="button"
            class="px-4 text-sm"
            :class="settingsStore.settings.goal === key ? 'chip-active' : 'chip-inactive'"
            @click="updateGoal(key as FitnessGoal)"
          >
            {{ label }}
          </button>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">일일 칼로리 목표</label>
            <input
              :value="settingsStore.settings.dailyTargets.calories ?? ''"
              type="number"
              inputmode="numeric"
              min="0"
              class="input mt-1"
              @change="updateTarget('calories', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
          <div>
            <label class="field-label">일일 단백질 목표(g)</label>
            <input
              :value="settingsStore.settings.dailyTargets.proteinG ?? ''"
              type="number"
              inputmode="numeric"
              min="0"
              class="input mt-1"
              @change="updateTarget('proteinG', Number(($event.target as HTMLInputElement).value))"
            />
          </div>
        </div>
      </section>

      <!-- 백업 -->
      <section class="card p-4 space-y-3">
        <h2 class="font-medium">백업 / 복원</h2>
        <button
          type="button"
          class="btn-secondary w-full py-2.5"
          :disabled="backupLoading"
          @click="handleBackup"
        >
          백업 파일 다운로드
        </button>
        <div class="flex gap-2 text-sm">
          <label class="flex items-center gap-1">
            <input v-model="importMode" type="radio" value="merge" />
            병합
          </label>
          <label class="flex items-center gap-1">
            <input v-model="importMode" type="radio" value="replace" />
            덮어쓰기
          </label>
        </div>
        <input
          ref="fileInput"
          type="file"
          accept=".json"
          class="w-full text-sm"
          @change="handleImport"
        />
      </section>

      <!-- AI 보내기 -->
      <section class="card p-4 space-y-3">
        <h2 class="font-medium">AI에게 보내기</h2>
        <p class="text-xs text-gray-400">
          ChatGPT, Claude 등 외부 AI에 붙여넣거나 파일로 첨부할 수 있습니다.
        </p>
        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="field-label">기간</label>
            <select v-model="period" class="input mt-1">
              <option :value="7">최근 7일</option>
              <option :value="30">최근 30일</option>
              <option value="all">전체</option>
            </select>
          </div>
          <div>
            <label class="field-label">형식</label>
            <select v-model="exportFormat" class="input mt-1">
              <option value="markdown">마크다운</option>
              <option value="json">포터블 JSON</option>
              <option value="prompt">프롬프트</option>
            </select>
          </div>
        </div>
        <div class="flex gap-2">
          <button
            type="button"
            class="btn-primary flex-1 py-2.5"
            :disabled="exportLoading"
            @click="download"
          >
            파일 다운로드
          </button>
          <button
            type="button"
            class="btn-secondary flex-1 py-2.5"
            :disabled="exportLoading"
            @click="copy"
          >
            클립보드 복사
          </button>
        </div>
      </section>

      <!-- AI 연결 -->
      <section class="card p-4 space-y-3">
        <h2 class="font-medium">AI 코치 연결 <span class="text-xs text-amber-600">실험</span></h2>
        <select
          :value="settingsStore.settings.aiProvider"
          class="input"
          @change="updateAiProvider(($event.target as HTMLSelectElement).value as AIProviderType)"
        >
          <option value="mock">규칙 기반 (기본)</option>
          <option value="openai">OpenAI</option>
          <option value="claude">Claude</option>
        </select>
        <div v-if="settingsStore.settings.aiProvider === 'openai'">
          <label class="field-label">OpenAI API Key</label>
          <input
            :value="settingsStore.settings.openaiApiKey ?? ''"
            type="password"
            placeholder="sk-..."
            autocomplete="off"
            class="input mt-1"
            @change="updateApiKey('openaiApiKey', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <div v-if="settingsStore.settings.aiProvider === 'claude'">
          <label class="field-label">Claude API Key</label>
          <input
            :value="settingsStore.settings.claudeApiKey ?? ''"
            type="password"
            placeholder="sk-ant-..."
            autocomplete="off"
            class="input mt-1"
            @change="updateApiKey('claudeApiKey', ($event.target as HTMLInputElement).value)"
          />
        </div>
        <p class="text-xs text-gray-400">API 키는 기기에만 저장됩니다.</p>
      </section>
    </div>
  </div>
</template>
