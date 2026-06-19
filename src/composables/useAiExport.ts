import { ref } from 'vue'
import { format } from 'date-fns'
import { buildCoachContext, type ExportPeriod } from '@/services/coach/aggregator'
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

  async function getContext() {
    return buildCoachContext(period.value)
  }

  async function download() {
    loading.value = true
    try {
      const ctx = await getContext()
      const dateStr = format(new Date(), 'yyyy-MM-dd')

      if (format_.value === 'markdown') {
        downloadFile(toMarkdown(ctx), `chotohwa-report-${dateStr}.md`, 'text/markdown')
      } else if (format_.value === 'json') {
        downloadFile(toPortableJson(ctx), `chotohwa-context-${dateStr}.json`, 'application/json')
      } else {
        const settings = await getSettings()
        const text = buildPrompt(ctx, settings.customPrompt)
        const ok = await copyToClipboard(text)
        toast.value = ok ? '클립보드에 복사됨' : '복사 실패'
      }
    } finally {
      loading.value = false
    }
  }

  async function copy() {
    loading.value = true
    try {
      const ctx = await getContext()
      const settings = await getSettings()
      let text: string

      if (format_.value === 'markdown') {
        text = toMarkdown(ctx)
      } else if (format_.value === 'json') {
        text = toPortableJson(ctx)
      } else {
        text = buildPrompt(ctx, settings.customPrompt)
      }

      const ok = await copyToClipboard(text)
      toast.value = ok ? '클립보드에 복사됨' : '복사 실패'
      setTimeout(() => { toast.value = '' }, 2000)
    } finally {
      loading.value = false
    }
  }

  return { period, format: format_, loading, toast, download, copy }
}
