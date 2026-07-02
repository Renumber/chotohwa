import type { AppSettings, FitnessGoal } from '@/types/log'
import { GOAL_LABELS } from '@/types/log'
import { buildCoachContext } from './aggregator'
import {
  buildMockAnalysis,
  chatCompleteOpenAI,
  chatCompleteClaude,
  type ChatHooks,
  type ChatMessage,
} from './providers'
import { toMarkdown } from '@/services/export/aiExport'
import { getSettings } from '@/db'

export type { ChatHooks }

export interface CoachChatSession {
  send(text: string, hooks?: ChatHooks): Promise<string>
  destroy(): Promise<void>
}

/** AI가 답변에 포함할 수 있는 설정 제안 */
export interface SettingsProposal {
  goal?: FitnessGoal
  calories?: number
  proteinG?: number
}

const PROPOSAL_BLOCK_RE = /```settings\s*([\s\S]*?)```/

/**
 * AI 응답에서 ```settings JSON 블록을 추출한다.
 * 반환: 제안이 있으면 제안 객체와 블록을 제거한 본문, 없으면 null.
 */
export function parseSettingsProposal(
  text: string,
): { proposal: SettingsProposal; cleanText: string } | null {
  const match = PROPOSAL_BLOCK_RE.exec(text)
  if (!match) return null
  try {
    const raw = JSON.parse(match[1]) as Record<string, unknown>
    const proposal: SettingsProposal = {}
    if (raw.goal === 'lean_bulk' || raw.goal === 'cut' || raw.goal === 'maintain') {
      proposal.goal = raw.goal
    }
    if (typeof raw.calories === 'number' && raw.calories > 0) {
      proposal.calories = Math.round(raw.calories)
    }
    if (typeof raw.proteinG === 'number' && raw.proteinG > 0) {
      proposal.proteinG = Math.round(raw.proteinG)
    }
    if (!proposal.goal && !proposal.calories && !proposal.proteinG) return null
    return {
      proposal,
      cleanText: text.replace(PROPOSAL_BLOCK_RE, '').trim(),
    }
  } catch {
    return null
  }
}

export function describeProposal(p: SettingsProposal): string {
  const parts: string[] = []
  if (p.goal) parts.push(`목표 ${GOAL_LABELS[p.goal]}`)
  if (p.calories) parts.push(`일일 ${p.calories}kcal`)
  if (p.proteinG) parts.push(`단백질 ${p.proteinG}g`)
  return parts.join(' · ')
}

function buildSystemPrompt(settings: AppSettings, contextMd: string): string {
  const weightLine = settings.bodyWeightKg
    ? `사용자 체중: ${settings.bodyWeightKg}kg`
    : '사용자 체중: 미입력'

  return [
    '당신은 친절한 개인 헬스 트레이너입니다. 한국어로 간결하고 실행 가능한 답변을 마크다운으로 작성하세요.',
    '사용자의 기록 데이터를 근거로 코칭하고, 질문에는 짧고 명확하게 답하세요.',
    '잘한 점을 먼저 짚고, 부족한 점과 구체적인 개선 방법을 제안하세요.',
    '',
    '사용자의 목표나 일일 칼로리·단백질 목표를 새로 정하거나 바꾸는 것이 좋겠다고 판단되면,',
    '답변 마지막에 아래 형식의 코드 블록을 정확히 포함하세요 (사용자가 버튼으로 적용할 수 있습니다):',
    '```settings',
    '{"goal": "lean_bulk|cut|maintain 중 하나", "calories": 2400, "proteinG": 140}',
    '```',
    '설정 변경 제안이 없으면 이 블록을 넣지 마세요.',
    '',
    '--- 사용자 프로필 및 최근 기록 ---',
    `현재 목표: ${GOAL_LABELS[settings.goal]}`,
    weightLine,
    '',
    contextMd,
    '--- 기록 끝 ---',
  ].join('\n')
}

function createMockChat(): CoachChatSession {
  let analyzed = false
  return {
    async send(text) {
      const wantsAnalysis = !analyzed || /분석|리뷰|피드백|평가/.test(text)
      if (wantsAnalysis) {
        analyzed = true
        const ctx = await buildCoachContext(7)
        return buildMockAnalysis(ctx)
      }
      return [
        '규칙 기반 엔진은 자유로운 질문에 답할 수 없습니다. 🙏',
        '',
        '- **"분석"** 이라고 입력하면 최근 7일 데이터를 규칙 기반으로 분석해 드립니다.',
        '- 대화형 코칭을 원하시면 **설정 → AI 코치 연결**에서 온디바이스 AI(Gemini Nano, Gemma) 또는 외부 API(OpenAI, Claude)를 선택해 주세요.',
      ].join('\n')
    },
    async destroy() {},
  }
}

function createHttpChat(
  type: 'openai' | 'claude',
  apiKey: string,
  systemPrompt: string,
): CoachChatSession {
  const history: ChatMessage[] = []
  return {
    async send(text, hooks) {
      history.push({ role: 'user', content: text })
      hooks?.onStatus?.('응답 대기 중...')
      const complete = type === 'openai' ? chatCompleteOpenAI : chatCompleteClaude
      const reply = await complete(apiKey, systemPrompt, history)
      history.push({ role: 'assistant', content: reply })
      return reply
    },
    async destroy() {
      history.length = 0
    },
  }
}

/**
 * 현재 설정에 맞는 코치 채팅 세션을 만든다.
 * 시스템 프롬프트에 최근 30일 기록·목표가 컨텍스트로 포함된다.
 */
export async function createCoachChat(hooks?: ChatHooks): Promise<CoachChatSession> {
  const settings = await getSettings()
  hooks?.onStatus?.('기록 데이터 준비 중...')
  const ctx = await buildCoachContext(30)
  const contextMd = toMarkdown(ctx)
  const systemPrompt = buildSystemPrompt(settings, contextMd)

  switch (settings.aiProvider) {
    case 'builtin': {
      const { createBuiltinChat } = await import('./onDevice')
      return createBuiltinChat(systemPrompt, hooks)
    }
    case 'gemma': {
      const { createGemmaChat } = await import('./onDevice')
      return createGemmaChat(systemPrompt, hooks)
    }
    case 'openai': {
      if (!settings.openaiApiKey) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 입력해 주세요.')
      }
      return createHttpChat('openai', settings.openaiApiKey, systemPrompt)
    }
    case 'claude': {
      if (!settings.claudeApiKey) {
        throw new Error('Claude API 키가 설정되지 않았습니다. 설정에서 입력해 주세요.')
      }
      return createHttpChat('claude', settings.claudeApiKey, systemPrompt)
    }
    default:
      return createMockChat()
  }
}
