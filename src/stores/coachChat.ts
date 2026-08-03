import { defineStore } from 'pinia'
import { ref } from 'vue'
import {
  createCoachChat,
  parseSettingsProposal,
  type CoachChatSession,
  type SettingsProposal,
} from '@/services/coach'
import { useSettingsStore } from '@/stores/settings'
import { getDayLog, saveDayLog } from '@/db'
import { formatDateKey, generateId } from '@/utils/helpers'
import { parseMealCommand } from '@/services/coach/mealCommand'
import { MEAL_TYPE_LABELS, type MealEntry } from '@/types/log'

export interface CoachMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  proposal?: SettingsProposal
  proposalApplied?: boolean
  mealLog?: { date: string; entries: MealEntry[] }
  mealLogUndone?: boolean
  isError?: boolean
}

// 세션 객체는 직렬화 불가(스토어 밖 모듈 변수로 유지)
let session: CoachChatSession | null = null
let activeChat: CoachChatSession | null = null
let cancelRequested = false
let activeAbortController: AbortController | null = null

export const useCoachChatStore = defineStore('coachChat', () => {
  const messages = ref<CoachMessage[]>([])
  const busy = ref(false)
  const status = ref('')

  async function ensureSession(signal: AbortSignal): Promise<CoachChatSession> {
    if (!session) {
      session = await createCoachChat({
        onStatus: (s) => { status.value = s },
        signal,
      })
    }
    return session
  }

  async function send(text: string) {
    const trimmed = text.trim()
    if (!trimmed || busy.value) return

    const mealCommand = parseMealCommand(trimmed)
    if (mealCommand) {
      busy.value = true
      messages.value.push({ id: generateId(), role: 'user', content: trimmed })
      try {
        if (mealCommand.entries.length === 0) {
          messages.value.push({
            id: generateId(),
            role: 'assistant',
            content: '음식과 수량을 함께 적어주세요. 예: **점심에 닭가슴살 200g과 밥 한 공기 먹었어.**',
          })
          return
        }

        const date = formatDateKey(new Date())
        const log = await getDayLog(date)
        log.meals.push(...mealCommand.entries)
        await saveDayLog(log)

        const lines = mealCommand.entries.map((entry) => {
          const nutrition = entry.calories > 0 ? ` · ${entry.calories}kcal` : ' · 영양 정보 미입력'
          return `- ${entry.name}${nutrition}`
        })
        messages.value.push({
          id: generateId(),
          role: 'assistant',
          content: `**오늘 ${MEAL_TYPE_LABELS[mealCommand.mealType]} 식사에 추가했어요.**\n\n${lines.join('\n')}`,
          mealLog: { date, entries: mealCommand.entries },
        })

        const old = session
        session = null
        if (old) void old.destroy().catch(() => {})
      } catch (e) {
        messages.value.push({
          id: generateId(),
          role: 'assistant',
          content: e instanceof Error ? e.message : '식사 기록을 저장하지 못했습니다.',
          isError: true,
        })
      } finally {
        busy.value = false
        status.value = ''
      }
      return
    }

    busy.value = true
    cancelRequested = false
    const abortController = new AbortController()
    activeAbortController = abortController
    status.value = '준비 중...'
    messages.value.push({ id: generateId(), role: 'user', content: trimmed })

    const assistantMsg: CoachMessage = { id: generateId(), role: 'assistant', content: '' }

    try {
      const chat = await ensureSession(abortController.signal)
      activeChat = chat
      if (cancelRequested) throw new Error('요청을 중지했습니다.')
      messages.value.push(assistantMsg)
      const current = () => messages.value.find((m) => m.id === assistantMsg.id)

      status.value = '생각 중...'
      const reply = await chat.send(trimmed, {
        onToken: (fullText) => {
          const msg = current()
          if (msg) msg.content = fullText
        },
        onStatus: (s) => { status.value = s },
        signal: abortController.signal,
      })
      if (cancelRequested) throw new Error('요청을 중지했습니다.')

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
      if (activeChat && session === activeChat) {
        const failedSession = session
        session = null
        void failedSession.destroy().catch(() => {})
      }
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
      activeChat = null
      if (activeAbortController === abortController) activeAbortController = null
      busy.value = false
      status.value = ''
    }
  }

  function cancel() {
    if (!busy.value || cancelRequested) return
    cancelRequested = true
    status.value = '중지 중...'
    activeAbortController?.abort()
    activeChat?.cancel?.()
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

  async function undoMealLog(messageId: string) {
    const msg = messages.value.find((m) => m.id === messageId)
    if (!msg?.mealLog || msg.mealLogUndone) return

    const entryIds = new Set(msg.mealLog.entries.map((entry) => entry.id))
    const log = await getDayLog(msg.mealLog.date)
    log.meals = log.meals.filter((entry) => !entryIds.has(entry.id))
    await saveDayLog(log)
    msg.mealLogUndone = true

    const old = session
    session = null
    if (old) void old.destroy().catch(() => {})
  }

  /** 대화와 세션을 초기화한다. 다음 메시지부터 최신 기록으로 컨텍스트를 다시 만든다. */
  async function reset() {
    activeAbortController?.abort()
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

  return { messages, busy, status, send, cancel, applyProposal, undoMealLog, reset }
})
