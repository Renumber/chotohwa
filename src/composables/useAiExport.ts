import { ref } from 'vue'
import { format } from 'date-fns'
import { buildCoachContext, type ExportPeriod } from '@/services/coach/aggregator'
import type { CoachContext } from '@/types/log'
import { toMarkdown, toPortableJson } from '@/services/export/aiExport'
import { buildPrompt } from '@/services/export/promptTemplates'
import { downloadFile, copyToClipboard } from '@/utils/helpers'
import { getSettings } from '@/db'

export type ExportFormat = 'markdown' | 'json' | 'prompt'

export function useAiExport() {
  const period = ref<ExportPeriod>(7)
  const format_ = ref<ExportFormat>('markdown')
  const loading = ref(false)
  const toast = ref('')
  let toastTimer: ReturnType<typeof setTimeout> | null = null

  function showToast(message: string) {
    toast.value = message
    if (toastTimer) clearTimeout(toastTimer)
    toastTimer = setTimeout(() => { toast.value = '' }, 2000)
  }

  async function buildText(ctx: CoachContext): Promise<string> {
    if (format_.value === 'markdown') return toMarkdown(ctx)
    if (format_.value === 'json') return toPortableJson(ctx)
    const settings = await getSettings()
    return buildPrompt(ctx, settings.customPrompt)
  }

  async function download() {
    loading.value = true
    try {
      const ctx = await buildCoachContext(period.value)
      const dateStr = format(new Date(), 'yyyy-MM-dd')

      if (format_.value === 'markdown') {
        downloadFile(toMarkdown(ctx), `chotohwa-report-${dateStr}.md`, 'text/markdown')
      } else if (format_.value === 'json') {
        downloadFile(toPortableJson(ctx), `chotohwa-context-${dateStr}.json`, 'application/json')
      } else {
        // 프롬프트 형식은 파일보다 붙여넣기 용도라 클립보드로 처리
        const ok = await copyToClipboard(await buildText(ctx))
        showToast(ok ? '클립보드에 복사됨' : '복사 실패')
      }
    } finally {
      loading.value = false
    }
  }

  async function copy() {
    loading.value = true
    try {
      const ctx = await buildCoachContext(period.value)
      const ok = await copyToClipboard(await buildText(ctx))
      showToast(ok ? '클립보드에 복사됨' : '복사 실패')
    } finally {
      loading.value = false
    }
  }

  return { period, format: format_, loading, toast, download, copy }
}
