import {
  GOAL_LABELS,
  MEAL_TYPE_LABELS,
  type CoachContext,
} from '@/types/log'

export function toMarkdown(ctx: CoachContext): string {
  const { meta, profile, summary, dailyLogs } = ctx
  const lines: string[] = []

  lines.push(`# 초토화 헬스 리포트 (${meta.period.from} ~ ${meta.period.to})`)
  lines.push('')
  lines.push('## 프로필')
  lines.push(`- 목표: ${GOAL_LABELS[profile.goal]}`)
  if (profile.dailyTargets?.calories) {
    lines.push(`- 일일 목표 칼로리: ${profile.dailyTargets.calories}kcal`)
  }
  if (profile.dailyTargets?.proteinG) {
    lines.push(`- 일일 목표 단백질: ${profile.dailyTargets.proteinG}g`)
  }
  lines.push('')
  lines.push('## 기간 요약')
  lines.push(`- 기록일: ${summary.totalDays}일 | 운동일: ${summary.workoutDays}일`)
  lines.push(
    `- 평균 칼로리: ${Math.round(summary.avgCalories)}kcal | 평균 단백질: ${Math.round(summary.avgProteinG)}g`,
  )
  lines.push(
    `- 평균 탄수: ${Math.round(summary.avgCarbsG)}g | 평균 지방: ${Math.round(summary.avgFatG)}g`,
  )
  lines.push(`- 총 유산소: ${summary.totalCardioMin}분`)

  if (Object.keys(summary.exerciseFrequency).length > 0) {
    lines.push('')
    lines.push('### 운동 빈도')
    for (const [name, count] of Object.entries(summary.exerciseFrequency)) {
      lines.push(`- ${name}: ${count}회`)
    }
  }

  lines.push('')
  lines.push('## 일별 기록')

  for (const day of dailyLogs) {
    lines.push(`### ${day.date}`)
    if (day.workouts.length > 0) {
      lines.push('**운동**')
      for (const w of day.workouts) {
        const note = w.note ? ` (${w.note})` : ''
        lines.push(`- ${w.name}: ${w.sets}${note}`)
      }
    }
    if (day.cardio.length > 0) {
      lines.push('**유산소**')
      for (const c of day.cardio) {
        let detail = `${c.type} ${c.durationMin}분`
        if (c.distanceKm) detail += `, ${c.distanceKm}km`
        if (c.calories) detail += `, ${c.calories}kcal`
        lines.push(`- ${detail}`)
      }
    }
    if (day.meals.length > 0) {
      lines.push('**식단**')
      for (const m of day.meals) {
        lines.push(
          `- [${MEAL_TYPE_LABELS[m.mealType]}] ${m.name}: ${m.calories}kcal (탄${m.carbsG}g 단${m.proteinG}g 지${m.fatG}g)`,
        )
      }
      lines.push(
        `- 합계: ${day.totals.calories}kcal (탄${day.totals.carbsG}g 단${day.totals.proteinG}g 지${day.totals.fatG}g)`,
      )
    }
    if (day.workouts.length === 0 && day.cardio.length === 0 && day.meals.length === 0) {
      lines.push('- 기록 없음')
    }
    lines.push('')
  }

  return lines.join('\n')
}

export function toPortableJson(ctx: CoachContext): string {
  const portable = {
    $schema: 'https://chotohwa.app/schemas/ai-context-v1.json',
    ...ctx,
    dailyLogs: ctx.dailyLogs.map((day) => ({
      date: day.date,
      workouts: day.workouts.map((w) => ({
        name: w.name,
        sets: w.sets,
        note: w.note,
      })),
      cardio: day.cardio.map((c) => ({
        type: c.type,
        durationMin: c.durationMin,
        distanceKm: c.distanceKm,
        calories: c.calories,
      })),
      meals: day.meals.map((m) => ({
        name: m.name,
        mealType: m.mealType,
        calories: m.calories,
        carbsG: m.carbsG,
        proteinG: m.proteinG,
        fatG: m.fatG,
      })),
      totals: day.totals,
      hasWorkout: day.hasWorkout,
    })),
  }
  return JSON.stringify(portable, null, 2)
}

export { buildPrompt } from './promptTemplates'
