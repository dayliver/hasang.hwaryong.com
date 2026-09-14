/** 브라우저에 올린 파일 (IndexedDB) */
export type AssetKind = 'musicxml' | 'image'

export interface AssetRecord {
  id: string
  name: string
  mime: string
  kind: AssetKind
  blob: Blob
  createdAt: number
}

const DB_NAME = 'hasang-assets'
const DB_VERSION = 1
const STORE = 'files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB를 열 수 없습니다.'))
  })
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error ?? new Error('저장소 오류'))
  })
}

export function newAssetId(): string {
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export async function putAsset(record: AssetRecord): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    await reqToPromise(tx.objectStore(STORE).put(record))
  } finally {
    db.close()
  }
}

export async function getAsset(id: string): Promise<AssetRecord | undefined> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    return await reqToPromise(tx.objectStore(STORE).get(id))
  } finally {
    db.close()
  }
}

export async function deleteAsset(id: string): Promise<void> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readwrite')
    await reqToPromise(tx.objectStore(STORE).delete(id))
  } finally {
    db.close()
  }
}

export async function listAllAssets(): Promise<AssetRecord[]> {
  const db = await openDb()
  try {
    const tx = db.transaction(STORE, 'readonly')
    return await reqToPromise(tx.objectStore(STORE).getAll())
  } finally {
    db.close()
  }
}

const MUSICXML_EXT = /\.(musicxml|xml|mxl)$/i
const IMAGE_EXT = /\.(png|jpe?g|webp|gif|svg)$/i

export function detectAssetKind(file: File): AssetKind | null {
  const name = file.name
  if (MUSICXML_EXT.test(name) || file.type.includes('xml') || name.toLowerCase().endsWith('.mxl')) {
    return 'musicxml'
  }
  if (IMAGE_EXT.test(name) || file.type.startsWith('image/')) {
    return 'image'
  }
  return null
}

export async function saveUploadedFile(
  file: File,
  expected: AssetKind,
  options?: { maxBytes?: number },
): Promise<AssetRecord> {
  const kind = detectAssetKind(file)
  if (kind !== expected) {
    if (expected === 'musicxml') {
      throw new Error('MusicXML 파일(.musicxml, .xml, .mxl)만 올릴 수 있습니다.')
    }
    throw new Error('이미지 파일(PNG, JPG, WebP, SVG 등)만 올릴 수 있습니다.')
  }

  const max = options?.maxBytes ?? (expected === 'musicxml' ? 12 * 1024 * 1024 : 20 * 1024 * 1024)
  if (file.size > max) {
    throw new Error(`파일이 너무 큽니다. ${(max / (1024 * 1024)).toFixed(0)}MB 이하로 올려 주세요.`)
  }

  const record: AssetRecord = {
    id: newAssetId(),
    name: file.name,
    mime: file.type || (expected === 'musicxml' ? 'application/xml' : 'application/octet-stream'),
    kind: expected,
    blob: file,
    createdAt: Date.now(),
  }
  await putAsset(record)
  return record
}
