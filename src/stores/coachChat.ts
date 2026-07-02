import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createCoachChat,
  parseSettingsProposal,
  type CoachChatSession,
  type SettingsProposal,
} from '@/services/coach'
import { useSettingsStore } from '@/stores/settings'
import { generateId } from '@/utils/helpers'

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  proposal?: SettingsProposal
  proposalApplied?: boolean
  isError?: boolean
}

// 세션 객체는 직렬화 불가(스토어 밖 모듈 변수로 유지)
let session: CoachChatSession | null = null

export const useCoachChatStore = defineStore('coachChat', () => {
  const messages = ref<CoachMessage[]>([])
  const busy = ref(false)
  const status = ref('')

  async function ensureSession(): Promise<CoachChatSession> {
    if (!session) {
      session = await createCoachChat({
        onStatus: (s) => { status.value = s },
      })
    }
    return session
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy.value) return

    busy.value = true
    status.value = '준비 중...'
    messages.value.push({ id: generateId(), role: 'user', content: trimmed })

    const assistantMsg: CoachMessage = { id: generateId(), role: 'assistant', content: '' }

    try {
      const chat = await ensureSession()
      messages.value.push(assistantMsg)
      const current = () => messages.value.find((m) => m.id === assistantMsg.id)

      status.value = '생각 중...'
      const reply = await chat.send(trimmed, {
        onToken: (fullText) => {
          const msg = current()
          if (msg) msg.content = fullText
        },
        onStatus: (s) => { status.value = s },
      })

      const msg = current()
      if (msg) {
        const parsed = parseSettingsProposal(reply)
        if (parsed) {
          msg.content = parsed.cleanText
          msg.proposal = parsed.proposal
        } else {
          msg.content = reply
        }
      }
    } catch (e) {
      const errText = e instanceof Error ? e.message : '오류가 발생했습니다.'
      const msg = messages.value.find((m) => m.id === assistantMsg.id)
      if (msg) {
        msg.content = errText
        msg.isError = true
      } else {
        messages.value.push({
          id: generateId(),
          role: 'assistant',
          content: errText,
          isError: true,
        })
      }
    } finally {
      busy.value = false
      status.value = ''
    }
  }

  async function applyProposal(messageId: string) {
    const msg = messages.value.find((m) => m.id === messageId)
    if (!msg?.proposal || msg.proposalApplied) return

    const settingsStore = useSettingsStore()
    const { goal, calories, proteinG } = msg.proposal
    await settingsStore.save({
      ...(goal ? { goal } : {}),
      dailyTargets: {
        ...settingsStore.settings.dailyTargets,
        ...(calories ? { calories } : {}),
        ...(proteinG ? { proteinG } : {}),
      },
    })
    msg.proposalApplied = true
  }

  /** 대화와 세션을 초기화한다. 다음 메시지부터 최신 기록으로 컨텍스트를 다시 만든다. */
  async function reset() {
    const old = session
    session = null
    messages.value = []
    busy.value = false
    status.value = ''
    if (old) {
      try {
        await old.destroy()
      } catch {
        // 세션 정리 실패는 무시
      }
    }
  }

  return { messages, busy, status, send, applyProposal, reset }
})
