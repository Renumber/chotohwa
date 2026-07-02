<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
import AppHeader from '@/components/layout/AppHeader.vue'
import MarkdownView from '@/components/common/MarkdownView.vue'
import { describeProposal } from '@/services/coach'
import { useCoachChatStore } from '@/stores/coachChat'
import { useSettingsStore } from '@/stores/settings'
import type { AIProviderType } from '@/types/log'

const chatStore = useCoachChatStore()
const settingsStore = useSettingsStore()

const input = ref('')
const scrollArea = ref<HTMLElement | null>(null)

const PROVIDER_LABELS: Record<AIProviderType, string> = {
  mock: '규칙 기반',
  builtin: 'Gemini Nano (온디바이스)',
  gemma: 'Gemma (온디바이스)',
  openai: 'OpenAI',
  claude: 'Claude',
}

const providerLabel = computed(
  () => PROVIDER_LABELS[settingsStore.settings.aiProvider],
)

const QUICK_PROMPTS = [
  '최근 7일 기록 분석해줘',
  '내 목표에 맞는 플랜 세워줘',
  '이번 주 플랜 잘 지켰는지 리뷰해줘',
  '오늘 뭘 개선하면 좋을까?',
]

onMounted(() => {
  void settingsStore.load()
})

watch(
  () => [chatStore.messages.length, chatStore.messages.at(-1)?.content.length],
  async () => {
    await nextTick()
    scrollArea.value?.scrollTo({ top: scrollArea.value.scrollHeight })
  },
)

function submit() {
  const text = input.value
  input.value = ''
  void chatStore.send(text)
}

function sendQuick(prompt: string) {
  void chatStore.send(prompt)
}
</script>

<template>
  <div class="flex h-dvh flex-col">
    <AppHeader title="코치" :subtitle="`AI 트레이너 · ${providerLabel}`" />

    <div ref="scrollArea" class="flex-1 overflow-y-auto">
      <div class="space-y-3 p-4 pb-4">
        <!-- 빈 상태: 안내 + 빠른 질문 -->
        <template v-if="chatStore.messages.length === 0">
          <div class="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
            🧪 실험 기능입니다. 운동·식단 기록과 목표가 대화 컨텍스트로 자동 포함됩니다.
          </div>
          <div class="card p-4 space-y-3">
            <p class="text-sm text-gray-600">
              안녕하세요, AI 트레이너입니다. 💪<br />
              기록 분석, 플랜 수립, 식단 질문 등 무엇이든 물어보세요.
            </p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="prompt in QUICK_PROMPTS"
                :key="prompt"
                type="button"
                class="chip-inactive"
                :disabled="chatStore.busy"
                @click="sendQuick(prompt)"
              >
                {{ prompt }}
              </button>
            </div>
          </div>
        </template>

        <!-- 메시지 목록 -->
        <template v-for="msg in chatStore.messages" :key="msg.id">
          <div v-if="msg.role === 'user'" class="flex justify-end">
            <p class="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary-600 px-3.5 py-2 text-sm text-white">
              {{ msg.content }}
            </p>
          </div>
          <div v-else class="flex justify-start">
            <div
              class="max-w-[92%] rounded-2xl rounded-bl-md px-3.5 py-2.5"
              :class="msg.isError ? 'bg-red-50 border border-red-200' : 'bg-white border border-gray-200'"
            >
              <p v-if="msg.isError" class="text-sm text-red-600">{{ msg.content }}</p>
              <MarkdownView v-else-if="msg.content" :content="msg.content" />
              <p v-else class="text-sm text-gray-400">...</p>

              <!-- AI 설정 제안 -->
              <div
                v-if="msg.proposal"
                class="mt-2 rounded-lg bg-primary-50 border border-primary-100 p-2.5"
              >
                <p class="text-xs text-gray-600">
                  💡 설정 제안: <span class="font-medium text-gray-800">{{ describeProposal(msg.proposal) }}</span>
                </p>
                <button
                  v-if="!msg.proposalApplied"
                  type="button"
                  class="btn-primary mt-2 w-full py-1.5 text-xs"
                  @click="chatStore.applyProposal(msg.id)"
                >
                  이 설정 적용하기
                </button>
                <p v-else class="mt-1.5 text-xs font-medium text-primary-700">✅ 적용됨</p>
              </div>
            </div>
          </div>
        </template>

        <!-- 진행 상태 -->
        <div
          v-if="chatStore.busy && chatStore.status"
          class="flex items-center gap-2 text-xs text-gray-500"
        >
          <span class="h-3 w-3 shrink-0 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          {{ chatStore.status }}
        </div>
      </div>
    </div>

    <!-- 입력 바 -->
    <div class="border-t border-gray-200 bg-white p-3 pb-[calc(0.75rem+56px)]">
      <div class="flex items-end gap-2">
        <button
          v-if="chatStore.messages.length"
          type="button"
          class="btn-secondary shrink-0 px-2.5 py-2 text-xs"
          title="새 대화 (최신 기록으로 컨텍스트 갱신)"
          :disabled="chatStore.busy"
          @click="chatStore.reset()"
        >
          ↺
        </button>
        <textarea
          v-model="input"
          rows="1"
          placeholder="질문하거나 분석을 요청해 보세요"
          class="input max-h-28 flex-1 resize-none"
          @keydown.enter.exact.prevent="submit"
        />
        <button
          type="button"
          class="btn-primary shrink-0 px-4 py-2"
          :disabled="chatStore.busy || !input.trim()"
          @click="submit"
        >
          전송
        </button>
      </div>
    </div>
  </div>
</template>
