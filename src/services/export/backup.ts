import { format } from 'date-fns'
import { db, getSettings } from '@/db'
import type { BackupFile } from '@/types/log'

const BACKUP_VERSION = 1 as const

export async function exportBackup(): Promise<BackupFile> {
  const [dayLogs, customExercises, settings] = await Promise.all([
    db.dayLogs.toArray(),
    db.customExercises.toArray(),
    getSettings(),
  ])

  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    dayLogs,
    customExercises,
    settings,
  }
}

export function downloadBackup(data: BackupFile) {
  const dateStr = format(new Date(), 'yyyy-MM-dd')
  const content = JSON.stringify(data, null, 2)
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `chotohwa-backup-${dateStr}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export type ImportMode = 'merge' | 'replace'

export async function importBackup(data: BackupFile, mode: ImportMode): Promise<void> {
  if (data.version !== BACKUP_VERSION) {
    throw new Error('지원하지 않는 백업 버전입니다.')
  }

  if (mode === 'replace') {
    await db.transaction('rw', db.dayLogs, db.customExercises, db.settings, async () => {
      await db.dayLogs.clear()
      await db.customExercises.clear()
      await db.settings.clear()
      await db.dayLogs.bulkPut(data.dayLogs)
      await db.customExercises.bulkPut(data.customExercises)
      await db.settings.put(data.settings)
    })
    return
  }

  await db.transaction('rw', db.dayLogs, db.customExercises, db.settings, async () => {
    for (const log of data.dayLogs) {
      await db.dayLogs.put(log)
    }
    for (const exercise of data.customExercises) {
      await db.customExercises.put(exercise)
    }
    await db.settings.put(data.settings)
  })
}

export async function parseBackupFile(file: File): Promise<BackupFile> {
  const text = await file.text()
  const data = JSON.parse(text) as BackupFile
  if (!data.version || !data.dayLogs) {
    throw new Error('유효하지 않은 백업 파일입니다.')
  }
  return data
}
