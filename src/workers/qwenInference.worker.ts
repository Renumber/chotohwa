import { Backend, Engine, type Conversation } from '@litert-lm/core'

interface InitRequest {
  type: 'init'
  model: File
  systemPrompt: string
  maxNumTokens: number
  maxOutputTokens: number
  resetThreshold: number
}

interface GenerateRequest {
  type: 'generate'
  requestId: number
  text: string
}

type WorkerRequest = InitRequest | GenerateRequest

type WorkerResponse =
  | { type: 'ready' }
  | { type: 'token'; requestId: number; text: string }
  | { type: 'complete'; requestId: number; text: string }
  | { type: 'error'; requestId?: number; message: string }

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<WorkerRequest>) => void): void
  postMessage(message: WorkerResponse): void
}

const workerScope = self as unknown as WorkerScope
const LITERT_WASM_BASE_URL =
  'https://cdn.jsdelivr.net/npm/@litert-lm/core@0.14.0/wasm/'
let engine: Engine | null = null
let conversation: Conversation | null = null
let systemPrompt = ''
let resetThreshold = 900
let maxOutputTokens = 96

function post(message: WorkerResponse) {
  workerScope.postMessage(message)
}

async function createConversation() {
  if (!engine) throw new Error('Qwen 엔진이 초기화되지 않았습니다.')
  return engine.createConversation({
    preface: { messages: [{ role: 'system', content: systemPrompt }] },
    sessionConfig: {
      maxOutputTokens,
      samplerParams: {
        temperature: 0.8,
        k: 40,
        p: 0.9,
      },
    },
  })
}

async function initialize(request: InitRequest) {
  systemPrompt = request.systemPrompt
  resetThreshold = request.resetThreshold
  maxOutputTokens = request.maxOutputTokens
  // 클래식 워커에서는 Emscripten이 WASM 경로를 워커 URL 기준으로 잡으므로 CDN을 명시한다.
  ;(self as unknown as {
    Module?: { locateFile: (fileName: string) => string }
  }).Module = {
    locateFile: (fileName) => `${LITERT_WASM_BASE_URL}${fileName}`,
  }
  engine = await Engine.create({
    model: request.model,
    backend: Backend.CPU,
    mainExecutorSettings: {
      maxNumTokens: request.maxNumTokens,
    },
    benchmarkEnabled: false,
  })
  conversation = await createConversation()
  post({ type: 'ready' })
}

async function generate(request: GenerateRequest) {
  if (!conversation) throw new Error('Qwen 대화 세션이 준비되지 않았습니다.')

  if (await conversation.getTokenCount() > resetThreshold) {
    const oldConversation = conversation
    conversation = await createConversation()
    await oldConversation.delete()
  }

  let result = ''
  const stream = conversation.sendMessageStreaming(request.text)
  for await (const chunk of stream) {
    const parts = typeof chunk.content === 'string'
      ? [{ type: 'text' as const, text: chunk.content }]
      : chunk.content ?? []
    for (const part of parts) {
      if (part.type !== 'text') continue
      result += part.text
      post({ type: 'token', requestId: request.requestId, text: result })
    }
  }
  post({
    type: 'complete',
    requestId: request.requestId,
    text: result || '응답을 받지 못했습니다.',
  })
}

workerScope.addEventListener('message', (event) => {
  const request = event.data
  const task = request.type === 'init'
    ? initialize(request)
    : generate(request)

  void task.catch((error: unknown) => {
    post({
      type: 'error',
      ...(request.type === 'generate' ? { requestId: request.requestId } : {}),
      message: error instanceof Error ? error.message : 'Qwen 실행 중 오류가 발생했습니다.',
    })
  })
})

export {}
