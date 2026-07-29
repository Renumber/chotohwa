import type { ChatHooks } from './providers'

/** 온디바이스 채팅 세션 — 대화 컨텍스트를 세션 내부에 유지한다 */
export interface OnDeviceChatSession {
  send(text: string, hooks?: ChatHooks): Promise<string>
  cancel?(): void
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
      + '온디바이스 Qwen/Gemma 또는 외부 API를 사용해 보세요.',
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

// ---- 온디바이스 모델 (LiteRT-LM, WebGPU) ----

export const GEMMA_MODEL_URL =
  'https://huggingface.co/litert-community/gemma-4-E2B-it-litert-lm/resolve/main/gemma-4-E2B-it-web.litertlm'
export const QWEN_MODEL_URL =
  'https://huggingface.co/litert-community/Qwen3-0.6B-int4/resolve/main/qwen3_0.6b_nothink_q4_block32_ekv1280.litertlm'

type OnDeviceModelId = 'gemma' | 'qwen'

interface OnDeviceModelConfig {
  id: OnDeviceModelId
  label: string
  url: string
  fileName: string
  expectedBytes: number
  downloadSizeLabel: string
  maxNumTokens: number
  resetThreshold: number
  legacyFileNames?: string[]
  legacyUrls?: string[]
}

const MODEL_CACHE_NAME = 'ondevice-llm-models'
const QWEN_INIT_TIMEOUT_MS = 120_000
const QWEN_GENERATION_TIMEOUT_MS = 90_000
const QWEN_MAX_OUTPUT_TOKENS = 96
const MODEL_CONFIGS: Record<OnDeviceModelId, OnDeviceModelConfig> = {
  gemma: {
    id: 'gemma',
    label: 'Gemma',
    url: GEMMA_MODEL_URL,
    fileName: 'gemma-4-E2B-it-web.litertlm',
    expectedBytes: 2.1 * 1024 ** 3,
    downloadSizeLabel: '약 2GB',
    maxNumTokens: 2048,
    resetThreshold: 1400,
  },
  qwen: {
    id: 'qwen',
    label: 'Qwen',
    url: QWEN_MODEL_URL,
    fileName: 'qwen3-0.6b-nothink-q4-block32-ekv1280.litertlm',
    expectedBytes: 350 * 1024 ** 2,
    downloadSizeLabel: '약 350MB',
    maxNumTokens: 1280,
    resetThreshold: 900,
    legacyFileNames: ['qwen3-0.6b-mixed-int4.litertlm'],
    legacyUrls: [
      'https://huggingface.co/litert-community/Qwen3-0.6B/resolve/main/qwen3_0_6b_mixed_int4.litertlm',
    ],
  },
}

interface ModelDownloadMetadata {
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

function metadataFileName(config: OnDeviceModelConfig): string {
  return `${config.fileName}.json`
}

async function isModelCached(config: OnDeviceModelConfig): Promise<boolean> {
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    try {
      const root = await navigator.storage.getDirectory()
      const metadataHandle = await root.getFileHandle(metadataFileName(config))
      const metadata = JSON.parse(await (await metadataHandle.getFile()).text()) as ModelDownloadMetadata
      const modelHandle = await root.getFileHandle(config.fileName)
      const modelFile = await modelHandle.getFile()
      if (metadata.complete && modelFile.size === metadata.totalBytes) return true
    } catch {
      // 완성된 OPFS 모델이 없으면 이전 Cache Storage 형식도 확인한다.
    }
  }

  if (!('caches' in globalThis)) return false
  const cache = await caches.open(MODEL_CACHE_NAME)
  return (await cache.match(config.url)) !== undefined
}

export function isGemmaModelCached(): Promise<boolean> {
  return isModelCached(MODEL_CONFIGS.gemma)
}

export function isQwenModelCached(): Promise<boolean> {
  return isModelCached(MODEL_CONFIGS.qwen)
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

async function removeLegacyModelFiles(config: OnDeviceModelConfig): Promise<void> {
  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    await Promise.all((config.legacyFileNames ?? []).flatMap((fileName) => [
      removeOpfsEntry(fileName),
      removeOpfsEntry(`${fileName}.json`),
    ]))
  }

  if ('caches' in globalThis && config.legacyUrls?.length) {
    const cache = await caches.open(MODEL_CACHE_NAME)
    await Promise.all(config.legacyUrls.map((url) => cache.delete(url)))
  }
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)}GB`
    : `${Math.round(bytes / 1024 ** 2)}MB`
}

function formatDownloadStatus(
  config: OnDeviceModelConfig,
  receivedBytes: number,
  totalBytes: number,
  resumed: boolean,
): string {
  const pct = Math.min(100, Math.round((receivedBytes / totalBytes) * 100))
  const action = resumed ? '이어받는 중' : '다운로드 중'
  return `${config.label} 모델 ${action}... ${pct}% (${formatBytes(receivedBytes)}/${formatBytes(totalBytes)})`
}

async function getOpfsModelFile(config: OnDeviceModelConfig): Promise<File> {
  const root = await navigator.storage.getDirectory()
  const handle = await root.getFileHandle(config.fileName)
  return handle.getFile()
}

async function getOpfsModelSize(config: OnDeviceModelConfig): Promise<number> {
  try {
    return (await getOpfsModelFile(config)).size
  } catch {
    return 0
  }
}

async function downloadModelToOpfs(
  config: OnDeviceModelConfig,
  hooks?: ChatHooks,
): Promise<File> {
  if (hooks?.signal?.aborted) throw new Error('요청을 중지했습니다.')
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    throw new Error('이 브라우저는 중단 가능한 모델 저장소를 지원하지 않습니다. 최신 Chrome을 사용해 주세요.')
  }

  await removeLegacyModelFiles(config)

  const estimate = await navigator.storage.estimate()
  const available = (estimate.quota ?? 0) - (estimate.usage ?? 0)
  const partialSize = await getOpfsModelSize(config)
  const minimumRequired = Math.max(0, config.expectedBytes - partialSize)
  if (estimate.quota && available < minimumRequired) {
    throw new Error(`${config.label} 모델을 저장할 공간이 부족합니다. 기기 저장 공간을 확보해 주세요.`)
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
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      hooks?.signal?.removeEventListener('abort', handleAbort)
      worker.terminate()
      callback()
    }
    const handleAbort = () => {
      finish(() => reject(new Error('요청을 중지했습니다.')))
    }
    hooks?.signal?.addEventListener('abort', handleAbort, { once: true })
    if (hooks?.signal?.aborted) {
      handleAbort()
      return
    }

    worker.addEventListener('message', (event: MessageEvent<ModelDownloadWorkerResponse>) => {
      const message = event.data
      if (message.type === 'progress') {
        hooks?.onStatus?.(formatDownloadStatus(
          config,
          message.receivedBytes,
          message.totalBytes,
          message.resumed,
        ))
        return
      }

      if (message.type === 'error') {
        finish(() => reject(new Error(message.message)))
        return
      }

      void getOpfsModelFile(config).then(
        (file) => finish(() => resolve(file)),
        (error) => finish(() => reject(error)),
      )
    })

    worker.addEventListener('error', (event) => {
      finish(() => reject(new Error(event.message || '모델 다운로드 작업이 중단되었습니다.')))
    })

    worker.postMessage({
      type: 'download',
      url: config.url,
      fileName: config.fileName,
      metadataFileName: metadataFileName(config),
    })
  })
}

/** OPFS에 모델을 내려받아 중단 후에도 이어받고, 디스크 기반 스트림으로 로드한다. */
async function fetchModelSource(
  config: OnDeviceModelConfig,
  hooks?: ChatHooks,
): Promise<Blob | ReadableStream<Uint8Array>> {
  const cache = 'caches' in globalThis ? await caches.open(MODEL_CACHE_NAME) : null

  const cached = await cache?.match(config.url)
  if (cached?.body) {
    hooks?.onStatus?.(`캐시된 ${config.label} 모델 로드 중...`)
    return cached.body
  }

  hooks?.onStatus?.(`${config.label} 모델 다운로드 준비 중... (${config.downloadSizeLabel})`)
  return downloadModelToOpfs(config, hooks)
}

type LiteRtEngine = import('@litert-lm/core').Engine

let activeEngine: { modelId: OnDeviceModelId; promise: Promise<LiteRtEngine> } | null = null

export async function releaseOnDeviceEngine(): Promise<void> {
  const loadedEngine = activeEngine
  activeEngine = null

  if (loadedEngine) {
    try {
      await (await loadedEngine.promise).delete()
    } catch {
      // 브라우저가 중단한 엔진은 이미 사용할 수 없으므로 저장 파일 정리를 계속한다.
    }
  }
}

/** 완성본과 이어받기 중인 파일을 모두 지워 다음 사용 시 처음부터 다시 받는다. */
async function clearModel(config: OnDeviceModelConfig): Promise<void> {
  if (activeEngine?.modelId === config.id) await releaseOnDeviceEngine()

  if ('caches' in globalThis) {
    const cache = await caches.open(MODEL_CACHE_NAME)
    await cache.delete(config.url)
  }

  if ('storage' in navigator && 'getDirectory' in navigator.storage) {
    await Promise.all([
      removeOpfsEntry(config.fileName),
      removeOpfsEntry(metadataFileName(config)),
    ])
  }

  await removeLegacyModelFiles(config)
}

export function clearGemmaModel(): Promise<void> {
  return clearModel(MODEL_CONFIGS.gemma)
}

export function clearQwenModel(): Promise<void> {
  return clearModel(MODEL_CONFIGS.qwen)
}

/** 엔진은 로드 비용이 커서 모듈 수준 싱글턴으로 유지한다. */
async function getEngine(
  config: OnDeviceModelConfig,
  hooks?: ChatHooks,
): Promise<LiteRtEngine> {
  if (activeEngine?.modelId !== config.id) {
    await releaseOnDeviceEngine()
    const promise = (async () => {
      if (!isWebGpuSupported()) {
        throw new Error(
          `이 브라우저는 WebGPU를 지원하지 않아 온디바이스 ${config.label} 모델을 실행할 수 없습니다. `
          + '최신 Chrome/Edge를 사용하거나 외부 API를 연결해 주세요.',
        )
      }
      hooks?.onStatus?.('LiteRT-LM 실행 환경 불러오는 중...')
      const { Engine, Backend } = await import('@litert-lm/core')
      const model = await fetchModelSource(config, hooks)

      hooks?.onStatus?.('GPU 확인 및 모델 컴파일 중... (수 초 소요)')
      return Engine.create({
        model,
        backend: Backend.GPU_ARTISAN,
        mainExecutorSettings: {
          maxNumTokens: config.maxNumTokens,
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
    activeEngine = { modelId: config.id, promise }
    promise.catch(() => {
      if (activeEngine?.promise === promise) activeEngine = null
    })
  }
  return activeEngine.promise
}

async function createLiteRtChat(
  config: OnDeviceModelConfig,
  systemPrompt: string,
  hooks?: ChatHooks,
): Promise<OnDeviceChatSession> {
  const engine = await getEngine(config, hooks)
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
    const generation = (async () => {
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
    })()
    await generation

    if (!result) return '응답을 받지 못했습니다.'
    return result
  }

  return {
    async send(text, sendHooks) {
      if (await conversation.getTokenCount() > config.resetThreshold) {
        await resetConversation(sendHooks)
      }

      const handleAbort = () => conversation.cancel()
      sendHooks?.signal?.addEventListener('abort', handleAbort, { once: true })
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
      } finally {
        sendHooks?.signal?.removeEventListener('abort', handleAbort)
      }
    },
    cancel() {
      conversation.cancel()
    },
    async destroy() {
      await conversation.delete()
    },
  }
}

type QwenWorkerResponse =
  | { type: 'ready' }
  | { type: 'token'; requestId: number; text: string }
  | { type: 'complete'; requestId: number; text: string }
  | { type: 'error'; requestId?: number; message: string }

function normalizeQwenOutput(result: string): string {
  const jsonText = result.trim().replace(/^```(?:json)?\s*|\s*```$/g, '')
  try {
    const parsed = JSON.parse(jsonText) as unknown
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const values = Object.values(parsed)
        .filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim())
      if (values.length) return values.join('\n')
    }
  } catch {
    // 일반 텍스트 응답은 그대로 표시한다.
  }
  return result
}

/** CPU 연산이 모바일 화면을 멈추지 않도록 Qwen 전체 추론을 별도 워커에서 실행한다. */
async function createQwenWorkerChat(
  systemPrompt: string,
  hooks?: ChatHooks,
): Promise<OnDeviceChatSession> {
  const config = MODEL_CONFIGS.qwen
  hooks?.onStatus?.(`${config.label} 모델 다운로드 준비 중... (${config.downloadSizeLabel})`)
  const model = await downloadModelToOpfs(config, hooks)
  if (hooks?.signal?.aborted) throw new Error('요청을 중지했습니다.')

  hooks?.onStatus?.('Qwen CPU 초기화 중... (휴대폰에서는 최대 2분)')
  const worker = new Worker(new URL('../../workers/qwenInference.worker.ts', import.meta.url), {
    // LiteRT WASM 로더가 워커 내부에서 importScripts를 사용하므로 classic이 필요하다.
    type: 'classic',
  })
  let terminated = false
  let requestId = 0
  let pending: {
    id: number
    resolve: (text: string) => void
    reject: (error: Error) => void
    hooks?: ChatHooks
    timeoutId: ReturnType<typeof setTimeout>
    handleAbort?: () => void
  } | null = null

  const stopWorker = (error?: Error) => {
    if (!terminated) {
      terminated = true
      worker.terminate()
    }
    if (pending) {
      clearTimeout(pending.timeoutId)
      if (pending.handleAbort) {
        pending.hooks?.signal?.removeEventListener('abort', pending.handleAbort)
      }
      const reject = pending.reject
      pending = null
      if (error) reject(error)
    }
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timeoutId)
      hooks?.signal?.removeEventListener('abort', handleAbort)
      callback()
    }
    const handleAbort = () => {
      stopWorker()
      finish(() => reject(new Error('요청을 중지했습니다.')))
    }
    const timeoutId = setTimeout(() => {
      stopWorker()
      finish(() => reject(new Error(
        'Qwen 초기화가 오래 걸려 중지했습니다. 다른 앱을 닫고 브라우저를 다시 실행해 주세요.',
      )))
    }, QWEN_INIT_TIMEOUT_MS)

    worker.addEventListener('message', (event: MessageEvent<QwenWorkerResponse>) => {
      const message = event.data
      if (message.type === 'ready') finish(resolve)
      if (message.type === 'error' && message.requestId === undefined) {
        stopWorker()
        finish(() => reject(new Error(message.message)))
      }
    })
    worker.addEventListener('error', (event) => {
      const error = new Error(event.message || 'Qwen 초기화에 실패했습니다.')
      stopWorker(error)
      finish(() => reject(error))
    })
    hooks?.signal?.addEventListener('abort', handleAbort, { once: true })
    if (hooks?.signal?.aborted) {
      handleAbort()
      return
    }
    worker.postMessage({
      type: 'init',
      model,
      systemPrompt,
      maxNumTokens: config.maxNumTokens,
      resetThreshold: config.resetThreshold,
      maxOutputTokens: QWEN_MAX_OUTPUT_TOKENS,
    })
  })

  worker.addEventListener('message', (event: MessageEvent<QwenWorkerResponse>) => {
    const message = event.data
    if (!pending || !('requestId' in message) || message.requestId !== pending.id) return
    if (message.type === 'token') {
      pending.hooks?.onToken?.(message.text)
      return
    }

    clearTimeout(pending.timeoutId)
    if (pending.handleAbort) {
      pending.hooks?.signal?.removeEventListener('abort', pending.handleAbort)
    }
    const current = pending
    pending = null
    if (message.type === 'error') {
      stopWorker()
      current.reject(new Error(message.message))
      return
    }
    const normalized = normalizeQwenOutput(message.text)
    current.hooks?.onToken?.(normalized)
    current.resolve(normalized)
  })

  return {
    send(text, sendHooks) {
      if (terminated) return Promise.reject(new Error('Qwen 세션이 종료되었습니다. 다시 시도해 주세요.'))
      if (pending) return Promise.reject(new Error('이전 응답이 아직 생성 중입니다.'))
      sendHooks?.onStatus?.('Qwen 응답 생성 중... (최대 90초)')
      const id = ++requestId
      const modelInput = `한국어 코칭 문장으로만 답하세요. JSON과 코드 블록은 쓰지 마세요.\n질문: ${text}`

      return new Promise<string>((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          stopWorker(new Error('응답 생성이 오래 걸려 중지했습니다. 질문을 짧게 바꿔 다시 시도해 주세요.'))
        }, QWEN_GENERATION_TIMEOUT_MS)
        const handleAbort = () => stopWorker(new Error('요청을 중지했습니다.'))
        pending = { id, resolve, reject, hooks: sendHooks, timeoutId, handleAbort }
        sendHooks?.signal?.addEventListener('abort', handleAbort, { once: true })
        if (sendHooks?.signal?.aborted) {
          handleAbort()
          return
        }
        worker.postMessage({ type: 'generate', requestId: id, text: modelInput })
      })
    },
    cancel() {
      stopWorker(new Error('요청을 중지했습니다.'))
    },
    async destroy() {
      stopWorker()
    },
  }
}

export function createGemmaChat(
  systemPrompt: string,
  hooks?: ChatHooks,
): Promise<OnDeviceChatSession> {
  return createLiteRtChat(MODEL_CONFIGS.gemma, systemPrompt, hooks)
}

export function createQwenChat(
  systemPrompt: string,
  hooks?: ChatHooks,
): Promise<OnDeviceChatSession> {
  return createQwenWorkerChat(systemPrompt, hooks)
}
