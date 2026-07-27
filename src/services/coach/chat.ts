import type { AppSettings, CoachContext, FitnessGoal } from '@/types/log'
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

const ON_DEVICE_SYSTEM_PROMPT_MAX_CHARS = 1400

function compactText(text: string, maxChars: number): string {
  return text.length <= maxChars ? text : `${text.slice(0, maxChars - 1)}…`
}

/** 모바일의 작은 컨텍스트에서도 동작하도록 기록 원문 대신 핵심 수치만 전달한다. */
function buildOnDeviceSystemPrompt(settings: AppSettings, ctx: CoachContext): string {
  const { summary } = ctx
  const weight = settings.bodyWeightKg ? `${settings.bodyWeightKg}kg` : '미입력'
  const targets = [
    settings.dailyTargets?.calories ? `${settings.dailyTargets.calories}kcal` : '',
    settings.dailyTargets?.proteinG ? `단백질 ${settings.dailyTargets.proteinG}g` : '',
  ].filter(Boolean).join(', ') || '미설정'
  const topExercises = Object.entries(summary.exerciseFrequency)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `${compactText(name, 18)} ${count}회`)
    .join(', ')

  const lines = [
    '너는 한국어 개인 헬스 코치다. 기록을 근거로 짧고 실행 가능하게 답하고, 잘한 점 다음에 개선점을 말한다.',
    '목표·칼로리·단백질 설정 변경을 제안할 때만 답변 끝에 ```settings 형식의 JSON을 넣는다.',
    '형식: ```settings\n{"goal":"lean_bulk|cut|maintain","calories":2400,"proteinG":140}\n```',
    `프로필: 목표=${GOAL_LABELS[settings.goal]}, 체중=${weight}, 일일목표=${targets}`,
    `최근 7일 요약: 기록 ${summary.totalDays}일, 운동 ${summary.workoutDays}일, 평균 ${Math.round(summary.avgCalories)}kcal/단백질 ${Math.round(summary.avgProteinG)}g, 유산소 ${summary.totalCardioMin}분`,
  ]

  if (topExercises) lines.push(`운동 빈도: ${topExercises}`)
  lines.push('최근 기록:')

  for (const day of [...ctx.dailyLogs].reverse()) {
    const details: string[] = []
    if (day.workouts.length) {
      const workouts = day.workouts.slice(0, 4).map((workout) => (
        `${compactText(workout.name, 16)} ${compactText(workout.sets, 70)}`
      ))
      details.push(`운동 ${workouts.join('; ')}`)
    }
    if (day.cardio.length) {
      details.push(`유산소 ${day.cardio.map((cardio) => `${cardio.type} ${cardio.durationMin}분`).join(', ')}`)
    }
    if (day.meals.length) {
      details.push(`식단합계 ${Math.round(day.totals.calories)}kcal/단백질 ${Math.round(day.totals.proteinG)}g`)
    }

    const line = `- ${day.date}: ${details.join(' | ') || '기록 없음'}`
    if ([...lines, line].join('\n').length > ON_DEVICE_SYSTEM_PROMPT_MAX_CHARS) break
    lines.push(line)
  }

  return lines.join('\n')
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
 * 온디바이스 모델에는 압축한 7일 기록을, 그 외 AI에는 30일 기록을 컨텍스트로 포함한다.
 */
export async function createCoachChat(hooks?: ChatHooks): Promise<CoachChatSession> {
  const settings = await getSettings()
  hooks?.onStatus?.('기록 데이터 준비 중...')

  switch (settings.aiProvider) {
    case 'builtin': {
      const ctx = await buildCoachContext(30)
      const systemPrompt = buildSystemPrompt(settings, toMarkdown(ctx))
      const { createBuiltinChat } = await import('./onDevice')
      return createBuiltinChat(systemPrompt, hooks)
    }
    case 'gemma': {
      const ctx = await buildCoachContext(7)
      const systemPrompt = buildOnDeviceSystemPrompt(settings, ctx)
      const { createGemmaChat } = await import('./onDevice')
      return createGemmaChat(systemPrompt, hooks)
    }
    case 'qwen': {
      const ctx = await buildCoachContext(7)
      const systemPrompt = buildOnDeviceSystemPrompt(settings, ctx)
      const { createQwenChat } = await import('./onDevice')
      return createQwenChat(systemPrompt, hooks)
    }
    case 'openai': {
      if (!settings.openaiApiKey) {
        throw new Error('OpenAI API 키가 설정되지 않았습니다. 설정에서 입력해 주세요.')
      }
      const ctx = await buildCoachContext(30)
      const systemPrompt = buildSystemPrompt(settings, toMarkdown(ctx))
      return createHttpChat('openai', settings.openaiApiKey, systemPrompt)
    }
    case 'claude': {
      if (!settings.claudeApiKey) {
        throw new Error('Claude API 키가 설정되지 않았습니다. 설정에서 입력해 주세요.')
      }
      const ctx = await buildCoachContext(30)
      const systemPrompt = buildSystemPrompt(settings, toMarkdown(ctx))
      return createHttpChat('claude', settings.claudeApiKey, systemPrompt)
    }
    default:
      return createMockChat()
  }
}
