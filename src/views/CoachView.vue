<script setup lang="ts">
import { ref } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import { analyzeRecentDays } from '@/services/coach'

const loading = ref(false)
const feedback = ref('')
const error = ref('')

async function analyze() {
  loading.value = true
  error.value = ''
  feedback.value = ''
  try {
    feedback.value = await analyzeRecentDays(7)
  } catch (e) {
    error.value = e instanceof Error ? e.message : '분석 중 오류가 발생했습니다.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div>
    <AppHeader title="코치" subtitle="실험 기능" />

    <div class="space-y-4 p-4 pb-24">
      <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
        🧪 실험 기능입니다. 설정에서 API를 연결하면 더 상세한 피드백을 받을 수 있습니다.
      </div>

      <button
        type="button"
        class="w-full rounded-xl bg-primary-600 py-3 text-white font-medium disabled:opacity-50"
        :disabled="loading"
        @click="analyze"
      >
        {{ loading ? '분석 중...' : '최근 7일 데이터 분석하기' }}
      </button>

      <p v-if="error" class="text-sm text-red-500">{{ error }}</p>

      <div
        v-if="feedback"
        class="rounded-xl bg-white border border-gray-200 p-4 prose prose-sm max-w-none whitespace-pre-wrap text-sm text-gray-800"
        v-text="feedback"
      />
    </div>
  </div>
</template>
