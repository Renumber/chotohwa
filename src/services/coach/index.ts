import type { CoachContext } from '@/types/log'
import { buildCoachContext } from './aggregator'
import { createProvider } from './providers'
import { buildPrompt } from '@/services/export/promptTemplates'
import { getSettings } from '@/db'

export async function analyzeRecentDays(days: 7 | 30 = 7): Promise<string> {
  const settings = await getSettings()
  const ctx = await buildCoachContext(days)
  const provider = createProvider(
    settings.aiProvider,
    settings.aiProvider === 'openai' ? settings.openaiApiKey : settings.claudeApiKey,
    (c: CoachContext) => buildPrompt(c, settings.customPrompt),
  )
  return provider.analyze(ctx)
}
