export function generateId(): string {
  return crypto.randomUUID()
}

export function formatDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}

export function sumMacros(
  meals: { calories: number; carbsG: number; proteinG: number; fatG: number }[],
) {
  return meals.reduce(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      carbsG: acc.carbsG + m.carbsG,
      proteinG: acc.proteinG + m.proteinG,
      fatG: acc.fatG + m.fatG,
    }),
    { calories: 0, carbsG: 0, proteinG: 0, fatG: 0 },
  )
}
