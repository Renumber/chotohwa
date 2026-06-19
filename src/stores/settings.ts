import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getSettings, saveSettings as persistSettings } from '@/db'
import type { AppSettings } from '@/types/log'
import { DEFAULT_SETTINGS } from '@/types/log'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...DEFAULT_SETTINGS })
  const loaded = ref(false)

  async function load() {
    settings.value = await getSettings()
    loaded.value = true
  }

  async function save(partial: Partial<AppSettings>) {
    settings.value = { ...settings.value, ...partial }
    await persistSettings(settings.value)
  }

  return { settings, loaded, load, save }
})
