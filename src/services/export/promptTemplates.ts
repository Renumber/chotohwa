import { GOAL_LABELS } from '@/types/log'
import type { CoachContext } from '@/types/log'
import { toMarkdown } from './aiExport'

export function buildPrompt(ctx: CoachContext, customPrompt?: string): string {
  const goalLabel = GOAL_LABELS[ctx.profile.goal]
  const header =
    customPrompt?.trim() ||
    `아래는 내 최근 헬스·식단 기록이다. 목표는 ${goalLabel}이다.\n부족한 점과 보완 방법을 구체적으로 알려줘.`

  return `${header}\n\n---\n${toMarkdown(ctx)}\n---`
}
