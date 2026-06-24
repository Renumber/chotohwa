import { ref, watch, onBeforeUnmount, toRaw } from 'vue'
import { getDayLog, saveDayLog, createEmptyDayLog } from '@/db'
import type { DayLog } from '@/types/log'

function cloneDayLog(value: DayLog): DayLog {
  return JSON.parse(JSON.stringify(toRaw(value))) as DayLog
}

export function useDayLog(getDate: () => string | null) {
  const log = ref<DayLog>(createEmptyDayLog(''))
  const loading = ref(false)
  const saving = ref(false)
  let saveTimer: ReturnType<typeof setTimeout> | null = null
  let loadGeneration = 0

  async function load() {
    const date = getDate()
    if (!date) {
      loading.value = false
      return
    }

    const gen = ++loadGeneration
    loading.value = true
    const data = await getDayLog(date)
    if (gen !== loadGeneration) return
    log.value = data.date === date ? data : { ...data, date }
    loading.value = false
  }

  async function persist() {
    const date = getDate()
    if (!date) return

    saving.value = true
    try {
      const payload = cloneDayLog(log.value)
      payload.date = date
      await saveDayLog(payload)
    } finally {
      saving.value = false
    }
  }

  async function flushSave() {
    if (saveTimer) {
      clearTimeout(saveTimer)
      saveTimer = null
    }
    await persist()
  }

  function scheduleSave(immediate = false) {
    if (!getDate()) return
    if (saveTimer) clearTimeout(saveTimer)
    if (immediate) {
      void flushSave()
      return
    }
    saveTimer = setTimeout(() => {
      saveTimer = null
      void persist()
    }, 300)
  }

  function update(mutator: (draft: DayLog) => void, immediate = false) {
    const date = getDate()
    if (!date) return

    const next = cloneDayLog(log.value)
    next.date = date
    mutator(next)
    next.updatedAt = new Date().toISOString()
    log.value = next
    scheduleSave(immediate)
  }

  onBeforeUnmount(() => {
    void flushSave()
  })

  watch(getDate, async (newDate, oldDate) => {
    if (oldDate && newDate !== oldDate) {
      await flushSave()
    }
    if (newDate) {
      await load()
    } else {
      loading.value = false
    }
  }, { immediate: true })

  return { log, loading, saving, update, reload: load, flushSave }
}
