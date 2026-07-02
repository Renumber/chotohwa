import type { ChatHooks } from './providers'

/** 온디바이스 채팅 세션 — 대화 컨텍스트를 세션 내부에 유지한다 */
export interface OnDeviceChatSession {
  send(text: string, hooks?: ChatHooks): Promise<string>
  destroy(): Promise<void>
}

// ---- Chrome 내장 AI (Prompt API / Gemini Nano) ----

export type BuiltinAvailability = LanguageModelAvailability | 'unsupported'

export async function getBuiltinAvailability(): Promise<BuiltinAvailability> {
  if (typeof LanguageModel === 'undefined') return 'unsupported'
  try {
    return await LanguageModel.availability()
  } catch {
    return 'unsupported'
  }
}

export async function createBuiltinChat(
  systemPrompt: string,
  hooks?: ChatHooks,
): Promise<OnDeviceChatSession> {
  if (typeof LanguageModel === 'undefined') {
    throw new Error(
      '이 브라우저는 내장 AI(Prompt API)를 지원하지 않습니다. '
      + '데스크탑 Chrome 138+ 에서 사용 가능하며, 모바일은 아직 지원되지 않습니다. '
      + '온디바이스 Gemma 또는 외부 API를 사용해 보세요.',
    )
  }

  const availability = await LanguageModel.availability()
  if (availability === 'unavailable') {
    throw new Error('이 기기에서는 내장 AI 모델(Gemini Nano)을 실행할 수 없습니다.')
  }
  if (availability !== 'available') {
    hooks?.onStatus?.('Gemini Nano 모델 다운로드 중... (최초 1회)')
  }

  const session = await LanguageModel.create({
    initialPrompts: [{ role: 'system', content: systemPrompt }],
    expectedInputs: [{ type: 'text', languages: ['ko'] }],
    expectedOutputs: [{ type: 'text', languages: ['ko'] }],
    monitor(m) {
      m.addEventListener('downloadprogress', (e) => {
        hooks?.onStatus?.(`Gemini Nano 다운로드 중... ${Math.round(e.loaded * 100)}%`)
      })
    },
  })

  return {
    async send(text, sendHooks) {
      const stream = session.promptStreaming(text)
      let result = ''
      for await (const chunk of stream) {
        result += chunk
        sendHooks?.onToken?.(result)
      }
      return result || '응답을 받지 못했습니다.'
    },
    async destroy() {
      session.destroy()
    },
  }
}

// ---- 온디바이스 Gemma (LiteRT-LM, WebGPU) ----

export const GEMMA_MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm'

const MODEL_CACHE_NAME = 'ondevice-llm-models'

export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export async function isGemmaModelCached(): Promise<boolean> {
  if (!('caches' in globalThis)) return false
  const cache = await caches.open(MODEL_CACHE_NAME)
  return (await cache.match(GEMMA_MODEL_URL)) !== undefined
}

/** Cache Storage 경유로 모델을 받아 재방문 시 재다운로드를 피한다. */
async function fetchModelBlob(hooks?: ChatHooks): Promise<Blob> {
  const cache = 'caches' in globalThis ? await caches.open(MODEL_CACHE_NAME) : null

  const cached = await cache?.match(GEMMA_MODEL_URL)
  if (cached) {
    hooks?.onStatus?.('캐시된 모델 로드 중...')
    return cached.blob()
  }

  hooks?.onStatus?.('Gemma 모델 다운로드 중... (약 2GB, 최초 1회)')
  const response = await fetch(GEMMA_MODEL_URL)
  if (!response.ok || !response.body) {
    throw new Error(`모델 다운로드 실패: ${response.status}`)
  }

  const total = Number(response.headers.get('Content-Length')) || 0
  const reader = response.body.getReader()
  const chunks: BlobPart[] = []
  let received = 0

  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    received += value.byteLength
    if (total > 0) {
      const pct = Math.round((received / total) * 100)
      const gb = (received / 1024 ** 3).toFixed(2)
      hooks?.onStatus?.(`Gemma 모델 다운로드 중... ${pct}% (${gb}GB)`)
    }
  }

  const blob = new Blob(chunks)
  if (cache) {
    try {
      await cache.put(GEMMA_MODEL_URL, new Response(blob))
    } catch {
      // 저장 공간 부족 등으로 캐시 실패해도 이번 실행은 진행
    }
  }
  return blob
}

type GemmaEngine = import('@litert-lm/core').Engine

let enginePromise: Promise<GemmaEngine> | null = null

/** 엔진은 로드 비용이 커서 모듈 수준 싱글턴으로 유지한다. */
async function getEngine(hooks?: ChatHooks): Promise<GemmaEngine> {
  if (!enginePromise) {
    enginePromise = (async () => {
      if (!isWebGpuSupported()) {
        throw new Error(
          '이 브라우저는 WebGPU를 지원하지 않아 온디바이스 Gemma를 실행할 수 없습니다. '
          + '최신 Chrome/Edge를 사용하거나 외부 API를 연결해 주세요.',
        )
      }
      const { Engine } = await import('@litert-lm/core')
      const blob = await fetchModelBlob(hooks)
      hooks?.onStatus?.('모델 초기화 중... (수 초 소요)')
      return Engine.create({
        model: blob,
        mainExecutorSettings: { maxNumTokens: 8192 },
      })
    })()
    enginePromise.catch(() => {
      enginePromise = null
    })
  }
  return enginePromise
}

export async function createGemmaChat(
  systemPrompt: string,
  hooks?: ChatHooks,
): Promise<OnDeviceChatSession> {
  const engine = await getEngine(hooks)
  const conversation = await engine.createConversation({
    preface: {
      messages: [{ role: 'system', content: systemPrompt }],
    },
  })

  return {
    async send(text, sendHooks) {
      let result = ''
      const stream = conversation.sendMessageStreaming(text)
      for await (const chunk of stream) {
        const parts = typeof chunk.content === 'string'
          ? [{ type: 'text' as const, text: chunk.content }]
          : chunk.content ?? []
        for (const part of parts) {
          if (part.type === 'text') {
            result += part.text
            sendHooks?.onToken?.(result)
          }
        }
      }
      return result || '응답을 받지 못했습니다.'
    },
    async destroy() {
      await conversation.delete()
    },
  }
}
