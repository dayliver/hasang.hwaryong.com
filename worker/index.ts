export interface Env {
  DB: D1Database
  ASSETS: Fetcher
  EDIT_PASSWORD?: string
}

interface BundleAsset {
  id: string
  name: string
  mime: string
  kind: 'musicxml' | 'image'
  createdAt: number
  dataBase64: string
}

interface MassBundle {
  version: number
  exportedAt?: string
  masses: MassSessionRow[]
  assets: BundleAsset[]
}

interface MassSessionRow {
  id: string
  title: string
  kind?: string
  scheduledAt?: string
  [key: string]: unknown
}

const CHUNK_CHARS = 80_000 // ~60KB binary per chunk; stay under D1 statement limits

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
    },
  })
}

function text(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })
}

function unauthorized(): Response {
  return text('편집 비밀번호가 필요합니다.', 401)
}

function requireEditAuth(request: Request, env: Env): boolean {
  const expected = env.EDIT_PASSWORD
  if (!expected) return false
  const header = request.headers.get('authorization') ?? ''
  const match = /^Bearer\s+(.+)$/i.exec(header)
  const token = match?.[1]?.trim() ?? ''
  return token.length > 0 && token === expected
}

function chunkBase64(dataBase64: string): string[] {
  const chunks: string[] = []
  for (let i = 0; i < dataBase64.length; i += CHUNK_CHARS) {
    chunks.push(dataBase64.slice(i, i + CHUNK_CHARS))
  }
  return chunks.length ? chunks : ['']
}

function base64ByteLength(dataBase64: string): number {
  const pad = dataBase64.endsWith('==') ? 2 : dataBase64.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((dataBase64.length * 3) / 4) - pad)
}

async function listMasses(env: Env): Promise<Response> {
  const { results } = await env.DB.prepare(
    `SELECT data_json FROM masses ORDER BY scheduled_at ASC, id ASC`,
  ).all<{ data_json: string }>()

  const masses = (results ?? []).map((row) => JSON.parse(row.data_json) as MassSessionRow)
  return json({ masses })
}

async function getMass(env: Env, id: string): Promise<Response> {
  const row = await env.DB.prepare(`SELECT data_json FROM masses WHERE id = ?`)
    .bind(id)
    .first<{ data_json: string }>()
  if (!row) return text('미사를 찾을 수 없습니다.', 404)
  return json(JSON.parse(row.data_json))
}

async function upsertMassRow(env: Env, mass: MassSessionRow): Promise<void> {
  const now = new Date().toISOString()
  await env.DB.prepare(
    `INSERT INTO masses (id, title, kind, scheduled_at, updated_at, data_json)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       title = excluded.title,
       kind = excluded.kind,
       scheduled_at = excluded.scheduled_at,
       updated_at = excluded.updated_at,
       data_json = excluded.data_json`,
  )
    .bind(
      mass.id,
      String(mass.title ?? ''),
      String(mass.kind ?? ''),
      String(mass.scheduledAt ?? ''),
      now,
      JSON.stringify(mass),
    )
    .run()
}

async function putAsset(env: Env, asset: BundleAsset): Promise<void> {
  const chunks = chunkBase64(asset.dataBase64)
  const byteLength = base64ByteLength(asset.dataBase64)

  await env.DB.prepare(`DELETE FROM asset_chunks WHERE asset_id = ?`).bind(asset.id).run()
  await env.DB.prepare(
    `INSERT INTO assets (id, name, mime, kind, created_at, byte_length)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       mime = excluded.mime,
       kind = excluded.kind,
       created_at = excluded.created_at,
       byte_length = excluded.byte_length`,
  )
    .bind(asset.id, asset.name, asset.mime, asset.kind, asset.createdAt, byteLength)
    .run()

  for (let i = 0; i < chunks.length; i += 1) {
    await env.DB.prepare(
      `INSERT INTO asset_chunks (asset_id, chunk_index, data_base64) VALUES (?, ?, ?)`,
    )
      .bind(asset.id, i, chunks[i]!)
      .run()
  }
}

async function importBundle(request: Request, env: Env): Promise<Response> {
  if (!requireEditAuth(request, env)) return unauthorized()

  let body: MassBundle
  try {
    body = (await request.json()) as MassBundle
  } catch {
    return text('JSON을 읽지 못했습니다.', 400)
  }

  if (!body || body.version !== 1 || !Array.isArray(body.masses) || !Array.isArray(body.assets)) {
    return text('번들 형식이 올바르지 않습니다.', 400)
  }
  if (!body.masses.length) return text('번들에 미사가 없습니다.', 400)

  for (const asset of body.assets) {
    if (!asset?.id || typeof asset.dataBase64 !== 'string') {
      return text('에셋 형식이 올바르지 않습니다.', 400)
    }
    await putAsset(env, asset)
  }

  for (const mass of body.masses) {
    if (!mass?.id) return text('미사 id가 없습니다.', 400)
    await upsertMassRow(env, mass)
  }

  return json({
    ok: true,
    masses: body.masses.length,
    assets: body.assets.length,
  })
}

async function putMass(request: Request, env: Env, id: string): Promise<Response> {
  if (!requireEditAuth(request, env)) return unauthorized()

  let mass: MassSessionRow
  try {
    mass = (await request.json()) as MassSessionRow
  } catch {
    return text('JSON을 읽지 못했습니다.', 400)
  }
  if (!mass?.id || mass.id !== id) return text('미사 id가 일치하지 않습니다.', 400)

  await upsertMassRow(env, mass)
  return json({ ok: true })
}

function collectAssetIds(mass: MassSessionRow): string[] {
  const ids: string[] = []
  const slides = Array.isArray(mass.slides) ? (mass.slides as Array<Record<string, unknown>>) : []
  for (const slide of slides) {
    if (typeof slide.imageAssetId === 'string') ids.push(slide.imageAssetId)
    const hymn = slide.hymn as Record<string, unknown> | undefined
    if (hymn && typeof hymn.musicXmlAssetId === 'string') ids.push(hymn.musicXmlAssetId)
    if (hymn && typeof hymn.scoreAssetId === 'string') ids.push(hymn.scoreAssetId)
  }
  return ids
}

async function assetUsedByOtherMass(env: Env, assetId: string, exceptMassId: string): Promise<boolean> {
  const { results } = await env.DB.prepare(`SELECT id, data_json FROM masses WHERE id != ?`)
    .bind(exceptMassId)
    .all<{ id: string; data_json: string }>()

  for (const row of results ?? []) {
    const mass = JSON.parse(row.data_json) as MassSessionRow
    if (collectAssetIds(mass).includes(assetId)) return true
  }
  return false
}

async function deleteAssetFully(env: Env, assetId: string): Promise<void> {
  await env.DB.prepare(`DELETE FROM asset_chunks WHERE asset_id = ?`).bind(assetId).run()
  await env.DB.prepare(`DELETE FROM assets WHERE id = ?`).bind(assetId).run()
}

async function deleteMass(env: Env, id: string, request: Request): Promise<Response> {
  if (!requireEditAuth(request, env)) return unauthorized()

  const row = await env.DB.prepare(`SELECT data_json FROM masses WHERE id = ?`)
    .bind(id)
    .first<{ data_json: string }>()
  if (!row) return text('미사를 찾을 수 없습니다.', 404)

  const mass = JSON.parse(row.data_json) as MassSessionRow
  const assetIds = collectAssetIds(mass)

  await env.DB.prepare(`DELETE FROM masses WHERE id = ?`).bind(id).run()

  for (const assetId of assetIds) {
    if (!(await assetUsedByOtherMass(env, assetId, id))) {
      await deleteAssetFully(env, assetId)
    }
  }

  return json({ ok: true })
}

function base64ToUint8Array(base64: string): Uint8Array {
  const bin = atob(base64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return bytes
}

async function getAsset(env: Env, id: string): Promise<Response> {
  const meta = await env.DB.prepare(
    `SELECT id, name, mime, kind, created_at, byte_length FROM assets WHERE id = ?`,
  )
    .bind(id)
    .first<{
      id: string
      name: string
      mime: string
      kind: string
      created_at: number
      byte_length: number
    }>()

  if (!meta) return text('파일을 찾을 수 없습니다.', 404)

  const { results } = await env.DB.prepare(
    `SELECT data_base64 FROM asset_chunks WHERE asset_id = ? ORDER BY chunk_index ASC`,
  )
    .bind(id)
    .all<{ data_base64: string }>()

  const joined = (results ?? []).map((r) => r.data_base64).join('')
  const bytes = base64ToUint8Array(joined)

  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': meta.mime || 'application/octet-stream',
      'content-length': String(bytes.byteLength),
      'cache-control': 'public, max-age=31536000, immutable',
      'x-asset-name': encodeURIComponent(meta.name),
      'x-asset-kind': meta.kind,
      'x-asset-created-at': String(meta.created_at),
    },
  })
}

async function putSingleAsset(request: Request, env: Env, id: string): Promise<Response> {
  if (!requireEditAuth(request, env)) return unauthorized()

  let asset: BundleAsset
  try {
    asset = (await request.json()) as BundleAsset
  } catch {
    return text('JSON을 읽지 못했습니다.', 400)
  }
  if (!asset?.id || asset.id !== id || typeof asset.dataBase64 !== 'string') {
    return text('에셋 형식이 올바르지 않습니다.', 400)
  }

  await putAsset(env, asset)
  return json({ ok: true })
}

async function handleApi(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/\/+$/, '') || '/'
  const method = request.method.toUpperCase()

  if (path === '/api/health' && method === 'GET') {
    return json({ ok: true })
  }

  if (path === '/api/masses' && method === 'GET') {
    return listMasses(env)
  }

  if (path === '/api/import' && method === 'POST') {
    return importBundle(request, env)
  }

  const massMatch = /^\/api\/masses\/([^/]+)$/.exec(path)
  if (massMatch) {
    const id = decodeURIComponent(massMatch[1]!)
    if (method === 'GET') return getMass(env, id)
    if (method === 'PUT') return putMass(request, env, id)
    if (method === 'DELETE') return deleteMass(env, id, request)
  }

  const assetMatch = /^\/api\/assets\/([^/]+)$/.exec(path)
  if (assetMatch) {
    const id = decodeURIComponent(assetMatch[1]!)
    if (method === 'GET') return getAsset(env, id)
    if (method === 'PUT') return putSingleAsset(request, env, id)
  }

  return text('Not found', 404)
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    if (url.pathname.startsWith('/api/')) {
      try {
        return await handleApi(request, env)
      } catch (err) {
        console.error('[api]', err)
        return text(err instanceof Error ? err.message : '서버 오류', 500)
      }
    }

    // /api 외 요청은 정적 자산으로 (run_worker_first가 /api/*만 호출)
    return env.ASSETS.fetch(request)
  },
}
