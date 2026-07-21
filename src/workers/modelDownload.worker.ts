interface DownloadRequest {
  type: 'download'
  url: string
  fileName: string
  metadataFileName: string
}

interface DownloadMetadata {
  url: string
  etag: string | null
  totalBytes: number
  complete: boolean
}

type DownloadResponse =
  | { type: 'progress'; receivedBytes: number; totalBytes: number; resumed: boolean }
  | { type: 'complete'; totalBytes: number }
  | { type: 'error'; message: string }

interface WorkerScope {
  addEventListener(type: 'message', listener: (event: MessageEvent<DownloadRequest>) => void): void
  postMessage(message: DownloadResponse): void
}

interface SyncAccessHandle {
  close(): void
  flush(): void
  getSize(): number
  truncate(newSize: number): void
  write(buffer: ArrayBufferView<ArrayBuffer>, options?: { at?: number }): number
}

interface SyncFileHandle extends FileSystemFileHandle {
  createSyncAccessHandle(): Promise<SyncAccessHandle>
}

const workerScope = self as unknown as WorkerScope
const FLUSH_INTERVAL_BYTES = 16 * 1024 * 1024
const PROGRESS_INTERVAL_BYTES = 4 * 1024 * 1024

function post(message: DownloadResponse) {
  workerScope.postMessage(message)
}

async function readMetadata(
  root: FileSystemDirectoryHandle,
  fileName: string,
): Promise<DownloadMetadata | null> {
  try {
    const handle = await root.getFileHandle(fileName)
    const file = await handle.getFile()
    return JSON.parse(await file.text()) as DownloadMetadata
  } catch {
    return null
  }
}

async function writeMetadata(
  root: FileSystemDirectoryHandle,
  fileName: string,
  metadata: DownloadMetadata,
) {
  const handle = await root.getFileHandle(fileName, { create: true })
  const writable = await handle.createWritable()
  await writable.write(JSON.stringify(metadata))
  await writable.close()
}

function parseRangeStart(contentRange: string | null): number | null {
  const match = contentRange?.match(/^bytes (\d+)-\d+\/\d+$/)
  return match ? Number(match[1]) : null
}

async function download({ url, fileName, metadataFileName }: DownloadRequest): Promise<number> {
  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle(fileName, { create: true })
  const accessHandle = await (fileHandle as SyncFileHandle).createSyncAccessHandle()

  try {
    const head = await fetch(url, { method: 'HEAD', cache: 'no-store' })
    if (!head.ok) throw new Error(`모델 정보 확인 실패: ${head.status}`)

    const totalBytes = Number(head.headers.get('Content-Length')) || 0
    const etag = head.headers.get('ETag')
    if (totalBytes <= 0) throw new Error('모델 파일 크기를 확인할 수 없습니다.')

    const metadata = await readMetadata(root, metadataFileName)
    let receivedBytes = accessHandle.getSize()
    const modelChanged = metadata
      && (metadata.url !== url || metadata.etag !== etag || metadata.totalBytes !== totalBytes)

    if (modelChanged || receivedBytes > totalBytes) {
      accessHandle.truncate(0)
      accessHandle.flush()
      receivedBytes = 0
    }

    if (receivedBytes === totalBytes) {
      await writeMetadata(root, metadataFileName, { url, etag, totalBytes, complete: true })
      return totalBytes
    }

    await writeMetadata(root, metadataFileName, { url, etag, totalBytes, complete: false })
    const resumed = receivedBytes > 0
    post({ type: 'progress', receivedBytes, totalBytes, resumed })

    const response = await fetch(url, {
      cache: 'no-store',
      headers: receivedBytes > 0 ? { Range: `bytes=${receivedBytes}-` } : undefined,
    })

    if (!response.ok || !response.body) {
      throw new Error(`모델 다운로드 실패: ${response.status}`)
    }

    if (receivedBytes > 0) {
      const rangeStart = parseRangeStart(response.headers.get('Content-Range'))
      if (response.status !== 206 || rangeStart !== receivedBytes) {
        accessHandle.truncate(0)
        accessHandle.flush()
        receivedBytes = 0
        throw new Error('이어받기 응답이 올바르지 않습니다. 다시 시도해 주세요.')
      }
    }

    const responseEtag = response.headers.get('ETag')
    if (etag && responseEtag && etag !== responseEtag) {
      accessHandle.truncate(0)
      accessHandle.flush()
      throw new Error('다운로드 중 모델 파일이 변경되었습니다. 다시 시도해 주세요.')
    }

    const reader = response.body.getReader()
    let bytesSinceFlush = 0
    let bytesSinceProgress = 0

    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue

      const buffer = value.buffer instanceof ArrayBuffer
        ? new Uint8Array(value.buffer, value.byteOffset, value.byteLength)
        : new Uint8Array(value)
      const written = accessHandle.write(buffer, { at: receivedBytes })
      if (written !== value.byteLength) throw new Error('모델 파일 저장에 실패했습니다.')
      receivedBytes += written
      bytesSinceFlush += written
      bytesSinceProgress += written

      if (bytesSinceFlush >= FLUSH_INTERVAL_BYTES) {
        accessHandle.flush()
        bytesSinceFlush = 0
      }
      if (bytesSinceProgress >= PROGRESS_INTERVAL_BYTES) {
        post({ type: 'progress', receivedBytes, totalBytes, resumed })
        bytesSinceProgress = 0
      }
    }

    accessHandle.flush()
    if (receivedBytes !== totalBytes) {
      throw new Error(`모델 다운로드가 불완전합니다. (${receivedBytes}/${totalBytes} bytes)`)
    }

    post({ type: 'progress', receivedBytes, totalBytes, resumed })
    await writeMetadata(root, metadataFileName, { url, etag, totalBytes, complete: true })
    return totalBytes
  } finally {
    accessHandle.close()
  }
}

workerScope.addEventListener('message', (event) => {
  if (event.data.type !== 'download') return
  void download(event.data)
    .then((totalBytes) => { post({ type: 'complete', totalBytes }) })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : '모델 다운로드에 실패했습니다.'
      post({ type: 'error', message })
    })
})

export {}
