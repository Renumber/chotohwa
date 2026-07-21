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
const GEMMA_MODEL_FILE = 'gemma-4-E2B-it-web.litertlm'
const GEMMA_METADATA_FILE = `${GEMMA_MODEL_FILE}.json`

interface GemmaDownloadMetadata {
  url: string
  etag: string | null
  totalBytes: number
  complete: boolean
}

type ModelDownloadWorkerResponse =
  | { type: 'progress'; receivedBytes: number; totalBytes: number; resumed: boolean }
  | { type: 'complete'; totalBytes: number }
  | { type: 'error'; message: string }

export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

export async function isGemmaModelCached(): Promise<boolean> {
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    try {
      const root = await navigator.storage.getDirectory()
      const metadataHandle = await root.getFileHandle(GEMMA_METADATA_FILE)
      const metadata = JSON.parse(await (await metadataHandle.getFile()).text()) as GemmaDownloadMetadata
      const modelHandle = await root.getFileHandle(GEMMA_MODEL_FILE)
      const modelFile = await modelHandle.getFile()
      if (metadata.complete && modelFile.size === metadata.totalBytes) return true
    } catch {
      // 완성된 OPFS 모델이 없으면 이전 Cache Storage 형식도 확인한다.
    }
  }

  if (!('caches' in globalThis)) return false
  const cache = await caches.open(MODEL_CACHE_NAME)
  return (await cache.match(GEMMA_MODEL_URL)) !== undefined
}

async function removeOpfsEntry(name: string): Promise<void> {
  try {
    const root = await navigator.storage.getDirectory()
    await root.removeEntry(name)
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') return
    throw error
  }
}

function formatDownloadStatus(receivedBytes: number, totalBytes: number, resumed: boolean): string {
  const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
  const receivedGb = (receivedBytes / 1024 ** 3).toFixed(2)
  const totalGb = (totalBytes / 1024 ** 3).toFixed(2)
  const prefix = resumed ? 'Gemma 모델 이어받는 중' : 'Gemma 모델 다운로드 중'
  return `${prefix}... ${pct}% (${receivedGb}/${totalGb}GB)`
}

async function getOpfsModelFile(): Promise<File> {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(GEMMA_MODEL_FILE)
  return handle.getFile()
}

async function getOpfsModelSize(): Promise<number> {
  try {
    return (await getOpfsModelFile()).size
  } catch {
    return 0
  }
}

async function downloadModelToOpfs(hooks?: ChatHooks): Promise<File> {
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    throw new Error('이 브라우저는 중단 가능한 모델 저장소를 지원하지 않습니다. 최신 Chrome을 사용해 주세요.')
  }

  const estimate = await navigator.storage.estimate()
  const available = (estimate.quota ?? 0) - (estimate.usage ?? 0)
  const partialSize = await getOpfsModelSize()
  const minimumRequired = Math.max(0, 2.1 * 1024 ** 3 - partialSize)
  if (estimate.quota && available < minimumRequired) {
    throw new Error('Gemma 모델을 저장할 공간이 부족합니다. 기기 저장 공간을 확보해 주세요.')
  }

  try {
    await navigator.storage.persist()
  } catch {
    // 영구 저장 권한이 없어도 OPFS 다운로드와 이어받기는 동작한다.
  }

  return new Promise<File>((resolve, reject) => {
    const worker = new Worker(new URL('../../workers/modelDownload.worker.ts', import.meta.url), {
      type: 'module',
    })

    worker.addEventListener('message', (event: MessageEvent<ModelDownloadWorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        hooks?.onStatus?.(formatDownloadStatus(
          message.receivedBytes,
          message.totalBytes,
          message.resumed,
        ))
        return
      }

      worker.terminate()
      if (message.type === 'error') {
        reject(new Error(message.message))
        return
      }

      void getOpfsModelFile().then(resolve, reject)
    })

    worker.addEventListener('error', (event) => {
      worker.terminate()
      reject(new Error(event.message || '모델 다운로드 작업이 중단되었습니다.'))
    })

    worker.postMessage({
      type: 'download',
      url: GEMMA_MODEL_URL,
      fileName: GEMMA_MODEL_FILE,
      metadataFileName: GEMMA_METADATA_FILE,
    })
  })
}

/** OPFS에 모델을 내려받아 중단 후에도 이어받고, 디스크 기반 스트림으로 로드한다. */
async function fetchModelSource(hooks?: ChatHooks): Promise<Blob | ReadableStream<Uint8Array>> {
  const cache = 'caches' in globalThis ? await caches.open(MODEL_CACHE_NAME) : null

  const cached = await cache?.match(GEMMA_MODEL_URL)
  if (cached?.body) {
    hooks?.onStatus?.('캐시된 모델 로드 중...')
    return cached.body
  }

  hooks?.onStatus?.('Gemma 모델 다운로드 준비 중... (약 2GB)')
  return downloadModelToOpfs(hooks)
}

type GemmaEngine = import('@litert-lm/core').Engine

let enginePromise: Promise<GemmaEngine> | null = null

/** 완성본과 이어받기 중인 파일을 모두 지워 다음 사용 시 처음부터 다시 받는다. */
export async function clearGemmaModel(): Promise<void> {
  const loadedEngine = enginePromise
  enginePromise = null

  if (loadedEngine) {
    try {
      await (await loadedEngine).delete()
    } catch {
      // 브라우저가 중단한 엔진은 이미 사용할 수 없으므로 저장 파일 정리를 계속한다.
    }
  }

  if ('caches' in globalThis) {
    const cache = await caches.open(MODEL_CACHE_NAME)
    await cache.delete(GEMMA_MODEL_URL)
  }

  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    await Promise.all([
      removeOpfsEntry(GEMMA_MODEL_FILE),
      removeOpfsEntry(GEMMA_METADATA_FILE),
    ])
  }
}

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
      hooks?.onStatus?.('LiteRT-LM 실행 환경 불러오는 중...')
      const { Engine, Backend } = await import('@litert-lm/core')
      const model = await fetchModelSource(hooks)
      hooks?.onStatus?.('GPU 확인 및 모델 컴파일 중... (수 초 소요)')
      return Engine.create({
        model,
        backend: Backend.GPU_ARTISAN,
        mainExecutorSettings: {
          maxNumTokens: 2048,
          backendConfig: {
            num_output_candidates: 1,
            wait_for_weight_uploads: true,
            num_decode_steps_per_sync: 1,
            sequence_batch_size: 0,
            supported_lora_ranks: [],
            max_top_k: 64,
            enable_decode_logits: false,
            enable_external_embeddings: false,
            use_submodel: true,
          },
        },
        benchmarkEnabled: false,
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
  const createConversation = () => engine.createConversation({
    preface: { messages: [{ role: 'system', content: systemPrompt }] },
  })
  const isContextLimitError = (error: unknown) => {
    const message = error instanceof Error ? error.message : String(error)
    return /token ids are too long|maximum number of tokens|context length/i.test(message)
  }

  hooks?.onStatus?.('대화 세션 준비 중...')
  let conversation = await createConversation()

  async function resetConversation(statusHooks?: ChatHooks) {
    statusHooks?.onStatus?.('대화가 길어져 컨텍스트를 정리하는 중...')
    const oldConversation = conversation
    conversation = await createConversation()
    try {
      await oldConversation.delete()
    } catch {
      // 이미 종료된 세션 정리 실패는 무시한다.
    }
  }

  async function generate(text: string, sendHooks?: ChatHooks): Promise<string> {
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
  }

  return {
    async send(text, sendHooks) {
      if (await conversation.getTokenCount() > 1400) {
        await resetConversation(sendHooks)
      }

      try {
        return await generate(text, sendHooks)
      } catch (error) {
        if (!isContextLimitError(error)) throw error
        await resetConversation(sendHooks)
        try {
          return await generate(text, sendHooks)
        } catch (retryError) {
          if (!isContextLimitError(retryError)) throw retryError
          throw new Error('질문이 너무 깁니다. 내용을 짧게 나누어 다시 입력해 주세요.')
        }
      }
    },
    async destroy() {
      await conversation.delete()
    },
  }
}
