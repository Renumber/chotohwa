import { CacheManager, Wllama, WllamaAbortError } from '@wllama/wllama'
import { QWEN_MODEL_URL, isMobileBrowser, isWebGpuSupported, type OnDeviceChatSession } from './onDevice'
import type { ChatHooks } from './providers'

const QWEN_MODEL_BYTES = 428_730_208

const WASM_URL = new URL(
  '../../../node_modules/@wllama/wllama/esm/wasm/wllama.wasm',
  import.meta.url,
).href
const COMPAT_WASM_URL = new URL(
  '../../../node_modules/@wllama/wllama-compat/wasm/wllama.wasm',
  import.meta.url,
).href
const COMPAT_JS_URL = new URL(
  '../../../node_modules/@wllama/wllama-compat/wasm/wllama.js',
  import.meta.url,
).href

const MAX_OUTPUT_TOKENS = 160
const CONTEXT_TOKENS = 1536
const MOBILE_BATCH = 128

type ChatTurn = { role: 'system' | 'user' | 'assistant'; content: string }

let activeRuntime: Promise<Wllama> | null = null

function hasMemory64(): boolean {
  try {
    new WebAssembly.Memory({ address: 'i64', initial: 1n } as unknown as WebAssembly.MemoryDescriptor)
    return true
  } catch {
    return false
  }
}

/** wllama 3.x 기본 wasm은 JSPI와 Memory64가 있는 Chrome만 인스턴스화된다. */
function needsCompatWasm(): boolean {
  return !('Suspending' in WebAssembly) || !hasMemory64()
}

function formatBytes(bytes: number): string {
  return bytes >= 1024 ** 3
    ? `${(bytes / 1024 ** 3).toFixed(2)}GB`
    : `${Math.round(bytes / 1024 ** 2)}MB`
}

function toKoreanError(error: unknown): Error {
  if (error instanceof WllamaAbortError) return new Error('요청을 중지했습니다.')
  if (error instanceof DOMException && error.name === 'AbortError') {
    return new Error('요청을 중지했습니다.')
  }
  const message = error instanceof Error ? error.message : String(error)
  if (/abort/i.test(message)) return new Error('요청을 중지했습니다.')
  if (/out of memory|allocation failed|memory access out of bounds/i.test(message)) {
    return new Error('휴대폰 메모리가 부족해 모델을 올리지 못했습니다. 다른 탭을 닫고 브라우저를 다시 연 뒤 시도해 주세요.')
  }
  if (/failed to fetch|networkerror|http 4|http 5/i.test(message)) {
    return new Error('모델 다운로드에 실패했습니다. Wi-Fi 연결을 확인한 뒤 다시 시도해 주세요.')
  }
  if (/no supported storage|opfs|getdirectory/i.test(message)) {
    return new Error('이 브라우저는 모델 저장소를 지원하지 않습니다. Chrome에서 열어 주세요.')
  }
  if (/simd|exception handling/i.test(message)) {
    return new Error('이 브라우저는 온디바이스 모델 실행에 필요한 WebAssembly 기능이 없습니다. Chrome을 업데이트해 주세요.')
  }
  return new Error(`온디바이스 Qwen 실행 실패: ${message}`)
}

async function openCache(): Promise<CacheManager> {
  try {
    return new CacheManager()
  } catch (error) {
    throw toKoreanError(error)
  }
}

export async function isQwenCached(): Promise<boolean> {
  try {
    const cache = await openCache()
    const name = await cache.getNameFromURL(QWEN_MODEL_URL)
    const metadata = await cache.getMetadata(name)
    return metadata?.originalURL === QWEN_MODEL_URL && metadata.originalSize === QWEN_MODEL_BYTES
  } catch {
    return false
  }
}

export async function releaseQwenRuntime(): Promise<void> {
  const pending = activeRuntime
  activeRuntime = null
  if (!pending) return
  try {
    await (await pending).exit()
  } catch {
    // 이미 내려간 런타임은 무시한다.
  }
}

export async function clearQwenCache(): Promise<void> {
  await releaseQwenRuntime()
  const cache = await openCache()
  await cache.delete(QWEN_MODEL_URL)
}

async function ensureStorageRoom(cached: boolean): Promise<void> {
  if (cached || !('storage' in navigator) || !navigator.storage.estimate) return
  try {
    await navigator.storage.persist()
  } catch {
    // 영구 저장 권한이 없어도 이번 세션 다운로드는 가능하다.
  }
  const estimate = await navigator.storage.estimate()
  const available = (estimate.quota ?? 0) - (estimate.usage ?? 0)
  if (estimate.quota && available < QWEN_MODEL_BYTES) {
    throw new Error('Qwen 모델을 저장할 공간이 부족합니다. 기기 저장 공간을 확보해 주세요.')
  }
}

async function loadRuntime(hooks?: ChatHooks): Promise<Wllama> {
  const cached = await isQwenCached()
  await ensureStorageRoom(cached)
  const mobile = isMobileBrowser()
  const cpuOnly = mobile || !isWebGpuSupported()
  if (needsCompatWasm()) {
    hooks?.onStatus?.('이 브라우저용 실행 파일을 준비하는 중...')
  }
  hooks?.onStatus?.(
    cached
      ? '저장된 Qwen 모델을 불러오는 중... (휴대폰에서는 최대 1분)'
      : 'Qwen 모델 다운로드 준비 중... (약 410MB)',
  )

  const start = async (gpuLayers: number | undefined) => {
    const wllama = new Wllama(
      { default: WASM_URL },
      { suppressNativeLog: true },
    )
    if (needsCompatWasm()) {
      wllama.setCompat({ worker: COMPAT_JS_URL, wasm: COMPAT_WASM_URL })
    }
    try {
      await wllama.loadModelFromUrl(QWEN_MODEL_URL, {
        useCache: true,
        signal: hooks?.signal,
        // 휴대폰 WebGPU는 어댑터가 있어도 셰이더에서 죽는다. CPU로 고정한다.
        n_gpu_layers: gpuLayers,
        n_threads: mobile ? 1 : undefined,
        n_ctx: CONTEXT_TOKENS,
        // vocab * n_batch 로짓 버퍼가 휴대폰 탭 메모리를 넘지 않게 배치를 줄인다.
        n_batch: mobile ? MOBILE_BATCH : 512,
        n_ubatch: mobile ? MOBILE_BATCH : 512,
        n_parallel: 1,
        kv_unified: true,
        cache_type_k: 'q8_0',
        cache_type_v: 'q8_0',
        flash_attn: false,
        warmup: false,
        progressCallback: ({ loaded, total }) => {
          if (!total) return
          if (loaded >= total) {
            hooks?.onStatus?.('Qwen을 메모리에 올리는 중... (휴대폰에서는 최대 1분)')
            return
          }
          const pct = Math.min(99, Math.round((loaded / total) * 100))
          hooks?.onStatus?.(
            `Qwen 모델 다운로드 중... ${pct}% (${formatBytes(loaded)}/${formatBytes(total)})`,
          )
        },
      })
      return wllama
    } catch (error) {
      await wllama.exit().catch(() => {})
      throw error
    }
  }

  if (hooks?.signal?.aborted) throw new Error('요청을 중지했습니다.')

  try {
    return await start(cpuOnly ? 0 : undefined)
  } catch (error) {
    if (cpuOnly) throw toKoreanError(error)
    hooks?.onStatus?.('GPU 초기화에 실패해 CPU로 다시 시도하는 중...')
    try {
      return await start(0)
    } catch (retryError) {
      throw toKoreanError(retryError)
    }
  }
}

function getRuntime(hooks?: ChatHooks): Promise<Wllama> {
  if (!activeRuntime) {
    const pending = loadRuntime(hooks)
    activeRuntime = pending
    pending.catch(() => {
      if (activeRuntime === pending) activeRuntime = null
    })
  }
  return activeRuntime
}

function trimHistory(messages: ChatTurn[]): void {
  const size = () => messages.reduce((sum, message) => sum + message.content.length, 0)
  while (messages.length > 3 && size() > 1800) {
    messages.splice(1, 2)
  }
}

function cleanOutput(text: string): string {
  return text
    .replace(/<\|im_end\|>|<\|endoftext\|>/g, '')
    .trim()
}

export async function createQwenSession(
  systemPrompt: string,
  hooks?: ChatHooks,
): Promise<OnDeviceChatSession> {
  const wllama = await getRuntime(hooks)
  const messages: ChatTurn[] = [{ role: 'system', content: systemPrompt }]
  let inflight: AbortController | null = null

  return {
    async send(text, sendHooks) {
      messages.push({ role: 'user', content: text })
      trimHistory(messages)
      const controller = new AbortController()
      inflight = controller
      let timedOut = false
      const timeoutId = setTimeout(() => {
        timedOut = true
        controller.abort()
      }, 180_000)
      const abortFromCaller = () => controller.abort()
      sendHooks?.signal?.addEventListener('abort', abortFromCaller, { once: true })
      sendHooks?.onStatus?.('Qwen이 기록을 읽는 중...')

      let result = ''
      try {
        const stream = await wllama.createChatCompletion({
          messages,
          max_tokens: MAX_OUTPUT_TOKENS,
          temperature: 0.7,
          top_k: 40,
          top_p: 0.9,
          stream: true,
          cache_prompt: true,
          abortSignal: controller.signal,
        })
        for await (const chunk of stream) {
          const progress = chunk.prompt_progress
          if (progress && progress.total > 0 && !result) {
            const pct = Math.min(100, Math.round((progress.processed / progress.total) * 100))
            sendHooks?.onStatus?.(`Qwen이 기록을 읽는 중... ${pct}%`)
          }
          const delta = chunk.choices[0]?.delta?.content
          if (!delta) continue
          result += delta
          sendHooks?.onToken?.(result)
          sendHooks?.onStatus?.('Qwen이 답변을 쓰는 중...')
        }
      } catch (error) {
        messages.pop()
        if (timedOut) {
          throw new Error('응답이 3분을 넘겨 중지했습니다. 질문을 짧게 바꿔 다시 시도해 주세요.')
        }
        throw toKoreanError(error)
      } finally {
        clearTimeout(timeoutId)
        sendHooks?.signal?.removeEventListener('abort', abortFromCaller)
        if (inflight === controller) inflight = null
      }

      const cleaned = cleanOutput(result)
      if (!cleaned) {
        messages.pop()
        return '응답을 받지 못했습니다.'
      }
      messages.push({ role: 'assistant', content: cleaned })
      sendHooks?.onToken?.(cleaned)
      return cleaned
    },
    cancel() {
      inflight?.abort()
    },
    async destroy() {
      inflight?.abort()
      messages.length = 0
    },
  }
}
