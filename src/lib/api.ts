import type { MassSession } from '../types/mass'
import type { BundleAsset, MassBundle } from './massBundle'

const EDIT_PASSWORD_KEY = 'hasang-edit-password'

export function getEditPassword(): string {
  try {
    return sessionStorage.getItem(EDIT_PASSWORD_KEY) ?? ''
  } catch {
    return ''
  }
}

export function setEditPassword(password: string): void {
  try {
    if (password) sessionStorage.setItem(EDIT_PASSWORD_KEY, password)
    else sessionStorage.removeItem(EDIT_PASSWORD_KEY)
  } catch {
    /* private mode 등 */
  }
}

export function askEditPassword(message = '편집 비밀번호를 입력하세요.'): string | null {
  const current = getEditPassword()
  const next = window.prompt(message, current)
  if (next === null) return null
  const trimmed = next.trim()
  setEditPassword(trimmed)
  return trimmed
}

function authHeaders(password?: string): HeadersInit {
  const token = password ?? getEditPassword()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

async function readError(res: Response): Promise<string> {
  const text = (await res.text().catch(() => '')).trim()
  return text || `요청 실패 (${res.status})`
}

/** 서버 미사 목록. API 실패 시 null */
export async function fetchRemoteMasses(): Promise<MassSession[] | null> {
  try {
    const res = await fetch('/api/masses', { cache: 'no-store' })
    if (!res.ok) return null
    const data = (await res.json()) as { masses?: MassSession[] }
    if (!Array.isArray(data.masses)) return null
    return data.masses
  } catch {
    return null
  }
}

/** JSON 번들을 D1(+에셋)에 저장 */
export async function uploadBundleToServer(
  bundle: MassBundle,
  password?: string,
): Promise<{ masses: number; assets: number }> {
  const token = password ?? getEditPassword()
  if (!token) throw new Error('편집 비밀번호가 필요합니다.')

  const res = await fetch('/api/import', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(bundle),
  })
  if (res.status === 401) throw new Error('편집 비밀번호가 올바르지 않습니다.')
  if (!res.ok) throw new Error(await readError(res))
  return (await res.json()) as { masses: number; assets: number }
}

export async function deleteRemoteMass(id: string, password?: string): Promise<void> {
  const token = password ?? getEditPassword()
  if (!token) throw new Error('편집 비밀번호가 필요합니다.')

  const res = await fetch(`/api/masses/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: authHeaders(token),
  })
  if (res.status === 401) throw new Error('편집 비밀번호가 올바르지 않습니다.')
  if (!res.ok) throw new Error(await readError(res))
}

export async function putRemoteMass(mass: MassSession, password?: string): Promise<void> {
  const token = password ?? getEditPassword()
  if (!token) throw new Error('편집 비밀번호가 필요합니다.')

  const res = await fetch(`/api/masses/${encodeURIComponent(mass.id)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(mass),
  })
  if (res.status === 401) throw new Error('편집 비밀번호가 올바르지 않습니다.')
  if (!res.ok) throw new Error(await readError(res))
}

export async function putRemoteAsset(asset: BundleAsset, password?: string): Promise<void> {
  const token = password ?? getEditPassword()
  if (!token) throw new Error('편집 비밀번호가 필요합니다.')

  const res = await fetch(`/api/assets/${encodeURIComponent(asset.id)}`, {
    method: 'PUT',
    headers: {
      'content-type': 'application/json',
      ...authHeaders(token),
    },
    body: JSON.stringify(asset),
  })
  if (res.status === 401) throw new Error('편집 비밀번호가 올바르지 않습니다.')
  if (!res.ok) throw new Error(await readError(res))
}

export async function fetchRemoteAssetBlob(id: string): Promise<{
  blob: Blob
  name: string
  mime: string
  kind: 'musicxml' | 'image'
  createdAt: number
} | null> {
  try {
    const res = await fetch(`/api/assets/${encodeURIComponent(id)}`, { cache: 'force-cache' })
    if (!res.ok) return null
    const mime = res.headers.get('content-type') || 'application/octet-stream'
    const name = decodeURIComponent(res.headers.get('x-asset-name') || id)
    const kindRaw = res.headers.get('x-asset-kind')
    const kind = kindRaw === 'musicxml' ? 'musicxml' : 'image'
    const createdAt = Number(res.headers.get('x-asset-created-at') || Date.now())
    const blob = await res.blob()
    return { blob, name, mime, kind, createdAt }
  } catch {
    return null
  }
}
