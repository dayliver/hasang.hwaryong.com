import type { VerovioToolkit } from 'verovio/esm'

let toolkitPromise: Promise<VerovioToolkit> | null = null

/** WASM 모듈은 한 번만 로드 (동적 import로 청크 분리) */
export function getVerovioToolkit(): Promise<VerovioToolkit> {
  if (!toolkitPromise) {
    toolkitPromise = (async () => {
      const [{ default: createVerovioModule }, { VerovioToolkit }] = await Promise.all([
        import('verovio/wasm'),
        import('verovio/esm'),
      ])
      const mod = await createVerovioModule()
      return new VerovioToolkit(mod)
    })()
  }
  return toolkitPromise
}

export function isZipBuffer(buf: ArrayBuffer): boolean {
  if (buf.byteLength < 4) return false
  const u = new Uint8Array(buf)
  return u[0] === 0x50 && u[1] === 0x4b // PK
}

/**
 * 베이스/아랫줄 숨김: staffDef visible=false (n이 큰 쪽 절반)
 * 그랜드 스태프·다성부 MEI 모두에 적용.
 */
export function meiHideLowerStaves(mei: string): string {
  const doc = new DOMParser().parseFromString(mei, 'application/xml')
  if (doc.querySelector('parsererror')) return mei

  const defs = [...doc.querySelectorAll('staffDef')]
  if (defs.length < 2) return mei

  const numbers = defs
    .map((el) => Number(el.getAttribute('n') || '0'))
    .filter((n) => n > 0)
    .sort((a, b) => a - b)
  const keepCount = Math.ceil(numbers.length / 2)
  const keep = new Set(numbers.slice(0, keepCount))

  for (const el of defs) {
    const n = Number(el.getAttribute('n') || '0')
    if (!keep.has(n)) el.setAttribute('visible', 'false')
  }

  return new XMLSerializer().serializeToString(doc)
}
