import { ref, watch } from 'vue'
import { getDayLog, saveDayLog } from '@/db'
import type { DayLog } from '@/types/log'
import { createEmptyDayLog } from '@/db'

export function useDayLog(date: () => string) {
  const log = ref<DayLog>(createEmptyDayLog(date()))
  const loading = ref(true)
  let saveTimer: ReturnType<typeof setTimeout> | null = null

  async function load() {
    loading.value = true
    log.value = await getDayLog(date())
    loading.value = false
  }

  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      void saveDayLog(log.value)
    }, 300)
  }

  function update(mutator: (draft: DayLog) => void) {
    mutator(log.value)
    log.value = { ...log.value, updatedAt: new Date().toISOString() }
    scheduleSave()
  }

  watch(date, () => {
    void load()
  }, { immediate: true })

  return { log, loading, update, reload: load }
}
