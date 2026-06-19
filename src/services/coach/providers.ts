import type { CoachContext } from '@/types/log'
import { GOAL_LABELS } from '@/types/log'

export interface AIProvider {
  analyze(ctx: CoachContext): Promise<string>
}

export class MockProvider implements AIProvider {
  async analyze(ctx: CoachContext): Promise<string> {
    const { summary, profile } = ctx
    const lines: string[] = ['## 코치 피드백 (규칙 기반)', '']

    lines.push(`목표 **${GOAL_LABELS[profile.goal]}** 기준으로 최근 ${ctx.meta.period.days}일 데이터를 분석했습니다.`)
    lines.push('')

    if (summary.workoutDays === 0) {
      lines.push('⚠️ 운동 기록이 없습니다. 주 3회 이상 근력 운동을 권장합니다.')
    } else {
      const rate = Math.round((summary.workoutDays / Math.max(summary.totalDays, 1)) * 100)
      lines.push(`✅ 운동일 ${summary.workoutDays}/${summary.totalDays}일 (${rate}%)`)
    }

    lines.push('')

    if (profile.dailyTargets?.proteinG) {
      const diff = summary.avgProteinG - profile.dailyTargets.proteinG
      if (diff < -10) {
        lines.push(
          `⚠️ 평균 단백질 **${Math.round(summary.avgProteinG)}g** — 목표 ${profile.dailyTargets.proteinG}g 대비 **${Math.abs(Math.round(diff))}g 부족**`,
        )
        lines.push('- 닭가슴살, 계란, 프로틴 셰이크로 보충을 고려하세요.')
      } else {
        lines.push(`✅ 평균 단백질 **${Math.round(summary.avgProteinG)}g** — 목표 달성 중`)
      }
    } else {
      lines.push(`ℹ️ 평균 단백질: **${Math.round(summary.avgProteinG)}g**`)
    }

    lines.push('')

    if (profile.goal === 'lean_bulk') {
      if (profile.dailyTargets?.calories && summary.avgCalories < profile.dailyTargets.calories - 200) {
        lines.push(
          `⚠️ 린메스업 중인데 평균 칼로리 **${Math.round(summary.avgCalories)}kcal**가 목표보다 낮습니다.`,
        )
        lines.push('- 탄수화물(밥, 고구마)과 건강한 지방(견과류)을 늘려보세요.')
      } else {
        lines.push('✅ 칼로리 섭취가 린메스업에 적합해 보입니다.')
      }
    } else if (profile.goal === 'cut') {
      if (profile.dailyTargets?.calories && summary.avgCalories > profile.dailyTargets.calories + 200) {
        lines.push(`⚠️ 컷팅 중인데 평균 칼로리가 목표를 초과하고 있습니다.`)
      }
    }

    if (summary.totalCardioMin < 90 && summary.workoutDays > 0) {
      lines.push('')
      lines.push(`ℹ️ 유산소 총 ${summary.totalCardioMin}분 — 주 150분 이상 권장`)
    }

    const topExercises = Object.entries(summary.exerciseFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)

    if (topExercises.length > 0) {
      lines.push('')
      lines.push('**자주 한 운동:** ' + topExercises.map(([n, c]) => `${n}(${c}회)`).join(', '))
    }

    lines.push('')
    lines.push('---')
    lines.push('*실험 기능입니다. 설정에서 API 연동 시 더 상세한 피드백을 받을 수 있습니다.*')

    return lines.join('\n')
  }
}

export class OpenAIProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private buildPrompt: (ctx: CoachContext) => string,
  ) {}

  async analyze(ctx: CoachContext): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              '당신은 친절한 개인 트레이너입니다. 한국어로 간결하고 실행 가능한 피드백을 마크다운으로 제공하세요.',
          },
          { role: 'user', content: this.buildPrompt(ctx) },
        ],
        max_tokens: 1500,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI API 오류: ${response.status} ${err}`)
    }

    const data = (await response.json()) as {
      choices: { message: { content: string } }[]
    }
    return data.choices[0]?.message?.content ?? '응답을 받지 못했습니다.'
  }
}

export class ClaudeProvider implements AIProvider {
  constructor(
    private apiKey: string,
    private buildPrompt: (ctx: CoachContext) => string,
  ) {}

  async analyze(ctx: CoachContext): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        system:
          '당신은 친절한 개인 트레이너입니다. 한국어로 간결하고 실행 가능한 피드백을 마크다운으로 제공하세요.',
        messages: [{ role: 'user', content: this.buildPrompt(ctx) }],
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`Claude API 오류: ${response.status} ${err}`)
    }

    const data = (await response.json()) as {
      content: { type: string; text: string }[]
    }
    return data.content[0]?.text ?? '응답을 받지 못했습니다.'
  }
}

export function createProvider(
  type: 'mock' | 'openai' | 'claude',
  apiKey: string | undefined,
  buildPrompt: (ctx: CoachContext) => string,
): AIProvider {
  if (type === 'openai' && apiKey) return new OpenAIProvider(apiKey, buildPrompt)
  if (type === 'claude' && apiKey) return new ClaudeProvider(apiKey, buildPrompt)
  return new MockProvider()
}
