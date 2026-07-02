// Chrome 내장 AI(Prompt API, Gemini Nano) 최소 타입 선언
// https://developer.chrome.com/docs/ai/prompt-api

type LanguageModelAvailability = 'unavailable' | 'downloadable' | 'downloading' | 'available'

interface LanguageModelMonitor extends EventTarget {
  addEventListener(
    type: 'downloadprogress',
    listener: (e: { loaded: number }) => void,
  ): void
}

interface LanguageModelCreateOptions {
  initialPrompts?: { role: 'system' | 'user' | 'assistant'; content: string }[]
  expectedInputs?: { type: 'text'; languages?: string[] }[]
  expectedOutputs?: { type: 'text'; languages?: string[] }[]
  monitor?(m: LanguageModelMonitor): void
  signal?: AbortSignal
}

interface LanguageModelSession {
  prompt(input: string, options?: { signal?: AbortSignal }): Promise<string>
  promptStreaming(input: string, options?: { signal?: AbortSignal }): ReadableStream<string>
  destroy(): void
}

interface LanguageModelStatic {
  availability(options?: Record<string, unknown>): Promise<LanguageModelAvailability>
  create(options?: LanguageModelCreateOptions): Promise<LanguageModelSession>
}

declare const LanguageModel: LanguageModelStatic | undefined
