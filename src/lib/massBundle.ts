import type { MassSession, Slide } from '../types/mass'
import { getAsset, putAsset, type AssetRecord } from './assetStore'

export const BUNDLE_VERSION = 1 as const
/** 정적 호스팅용으로 리포에 둘 기본 경로 (미사 하나 또는 여러 개) */
export const BUNDLE_PUBLIC_PATH = '/data/hasang-bundle.json'

export interface BundleAsset {
  id: string
  name: string
  mime: string
  kind: 'musicxml' | 'image'
  createdAt: number
  /** raw base64 (data URL prefix 없음) */
  dataBase64: string
}

export interface MassBundle {
  version: typeof BUNDLE_VERSION
  exportedAt: string
  masses: MassSession[]
  assets: BundleAsset[]
}

function collectAssetIds(masses: MassSession[]): Set<string> {
  const ids = new Set<string>()
  for (const mass of masses) {
    for (const slide of mass.slides) {
      if (slide.imageAssetId) ids.add(slide.imageAssetId)
      if (slide.hymn?.musicXmlAssetId) ids.add(slide.hymn.musicXmlAssetId)
      if (slide.hymn?.scoreAssetId) ids.add(slide.hymn.scoreAssetId)
    }
  }
  return ids
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = String(reader.result ?? '')
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('파일을 읽지 못했습니다.'))
    reader.readAsDataURL(blob)
  })
}

function base64ToBlob(base64: string, mime: string): Blob {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: mime || 'application/octet-stream' })
}

function fileSlug(title: string): string {
  const s = title
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w가-힣-]+/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
  return (s || 'mass').slice(0, 48)
}

function clonePlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

/** 지정한 미사만 포함 (참조 에셋만). 미사 단위 export용 */
export async function buildMassBundle(masses: MassSession[]): Promise<MassBundle> {
  if (!masses.length) throw new Error('내보낼 미사가 없습니다.')
  // store에서 온 reactive Proxy는 structuredClone 불가 → 평문으로
  const plainMasses = clonePlain(masses)
  const wanted = collectAssetIds(plainMasses)
  const assets: BundleAsset[] = []

  for (const id of wanted) {
    const record = await getAsset(id)
    if (!record) continue
    assets.push({
      id: record.id,
      name: record.name,
      mime: record.mime,
      kind: record.kind,
      createdAt: record.createdAt,
      dataBase64: await blobToBase64(record.blob),
    })
  }

  return {
    version: BUNDLE_VERSION,
    exportedAt: new Date().toISOString(),
    masses: plainMasses,
    assets,
  }
}

export async function buildSingleMassBundle(mass: MassSession): Promise<MassBundle> {
  return buildMassBundle([mass])
}

export function parseMassBundle(raw: unknown): MassBundle {
  if (!raw || typeof raw !== 'object') throw new Error('번들 형식이 올바르지 않습니다.')
  const obj = raw as Partial<MassBundle>
  if (obj.version !== BUNDLE_VERSION) {
    throw new Error(`지원하지 않는 번들 버전입니다. (version=${String(obj.version)})`)
  }
  if (!Array.isArray(obj.masses) || !Array.isArray(obj.assets)) {
    throw new Error('번들에 masses / assets 배열이 없습니다.')
  }
  if (obj.masses.length === 0) throw new Error('번들에 미사가 없습니다.')
  return obj as MassBundle
}

/** IndexedDB에 에셋만 반영 (미사 목록은 store에서 upsert) */
export async function applyMassBundleAssets(bundle: MassBundle): Promise<void> {
  for (const item of bundle.assets) {
    const record: AssetRecord = {
      id: item.id,
      name: item.name,
      mime: item.mime,
      kind: item.kind,
      createdAt: item.createdAt,
      blob: base64ToBlob(item.dataBase64, item.mime),
    }
    await putAsset(record)
  }
}

/** @deprecated 이름 호환 — 에셋만 적용 */
export async function applyMassBundle(bundle: MassBundle): Promise<void> {
  await applyMassBundleAssets(bundle)
}

export function defaultBundleFilename(bundle: MassBundle): string {
  const stamp = bundle.exportedAt.slice(0, 10)
  if (bundle.masses.length === 1) {
    const m = bundle.masses[0]!
    return `hasang-${fileSlug(m.title)}-${stamp}.json`
  }
  return `hasang-bundle-${stamp}.json`
}

export function downloadMassBundle(bundle: MassBundle, filename?: string): void {
  const json = JSON.stringify(bundle)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename ?? defaultBundleFilename(bundle)
  a.click()
  URL.revokeObjectURL(url)
}

export async function readBundleFromFile(file: File): Promise<MassBundle> {
  const text = await file.text()
  return parseMassBundle(JSON.parse(text) as unknown)
}

/** 정적 호스팅용 public/data 번들 — 없으면 null */
export async function fetchPublicBundle(): Promise<MassBundle | null> {
  try {
    const res = await fetch(BUNDLE_PUBLIC_PATH, { cache: 'no-cache' })
    if (!res.ok) return null
    return parseMassBundle(await res.json())
  } catch {
    return null
  }
}

export function summarizeBundle(bundle: MassBundle): string {
  if (bundle.masses.length === 1) {
    const m = bundle.masses[0]!
    return `「${m.title}」 · 슬라이드 ${m.slides.length}장 · 파일 ${bundle.assets.length}개`
  }
  const slides = bundle.masses.reduce((n, m) => n + m.slides.length, 0)
  return `미사 ${bundle.masses.length}개 · 슬라이드 ${slides}장 · 파일 ${bundle.assets.length}개`
}

export function slideAssetIds(slide: Slide): string[] {
  const ids: string[] = []
  if (slide.imageAssetId) ids.push(slide.imageAssetId)
  if (slide.hymn?.musicXmlAssetId) ids.push(slide.hymn.musicXmlAssetId)
  if (slide.hymn?.scoreAssetId) ids.push(slide.hymn.scoreAssetId)
  return ids
}
