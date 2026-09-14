import type { MassSession, ScoreStyle, Slide } from '../types/mass'
import { getAsset } from './assetStore'
import { getScoreFont, ensureScoreFontsLoaded } from './scoreFonts'
import {
  colorsForStyle,
  clampLyricsScale,
  clampSpacingLinear,
  clampSpacingNonLinear,
  clampSystemsPerPage,
  styleForSlide,
} from './scoreStyle'
import { getVerovioToolkit, isZipBuffer, meiHideLowerStaves } from './verovioToolkit'

export type ScorePayload = { kind: 'xml'; text: string } | { kind: 'zip'; buffer: ArrayBuffer }

export interface ScorePageCache {
  pageCount: number
  /** 테마 적용된 페이지 SVG HTML */
  pages: string[]
}

export interface ScoreRenderInput {
  assetId?: string
  src?: string
  scoreStyle?: ScoreStyle | null
  compact?: boolean
}

const pageCache = new Map<string, ScorePageCache>()
/** toolkit은 싱글톤이라 동시 판각 금지 */
let renderLock: Promise<void> = Promise.resolve()

function withRenderLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = renderLock.then(fn, fn)
  renderLock = run.then(
    () => undefined,
    () => undefined,
  )
  return run
}

export function scoreStyleKey(style?: ScoreStyle | null): string {
  if (!style) return ''
  return [
    style.palette ?? '',
    style.fontId ?? '',
    style.staffFilter ?? '',
    style.lyricsScale ?? '',
    style.spacingNonLinear ?? '',
    style.spacingLinear ?? '',
    style.systemsPerPage ?? '',
    style.musicColor ?? '',
    style.chordColor ?? '',
    style.lyricsColor ?? '',
    style.secondaryLyricsColor ?? '',
  ].join('\0')
}

export function makeScoreCacheKey(input: ScoreRenderInput): string {
  return [
    input.assetId ?? '',
    input.src ?? '',
    input.compact ? '1' : '0',
    scoreStyleKey(input.scoreStyle),
  ].join('\0')
}

export function getScorePageCache(key: string): ScorePageCache | undefined {
  return pageCache.get(key)
}

export function setScorePageCache(key: string, entry: ScorePageCache): void {
  pageCache.set(key, entry)
}

export function clearScorePageCache(): void {
  pageCache.clear()
}

function hasForcedSystemBreaks(source: string): boolean {
  return /new-system\s*=\s*["']yes["']/i.test(source) || /<sb[\s/>]/i.test(source)
}

function verovioLyricSize(scale: number): number {
  const s = clampLyricsScale(scale)
  const t = (s - 0.8) / (1.8 - 0.8)
  return Math.round((2 + t * 6) * 100) / 100
}

export function buildVerovioOptions(
  style: ScoreStyle | null | undefined,
  compact: boolean,
  breaks: 'none' | 'line' = 'none',
  inputFrom: 'xml' | 'mei' = 'xml',
  paginate = false,
) {
  const lyricsScale = clampLyricsScale(style?.lyricsScale)
  return {
    inputFrom,
    scale: compact ? 36 : 42,
    pageWidth: compact ? 1400 : 2000,
    adjustPageHeight: true,
    adjustPageWidth: false,
    breaks,
    footer: 'none' as const,
    header: 'auto' as const,
    usePgHeaderForAll: false,
    svgViewBox: true,
    spacingNonLinear: clampSpacingNonLinear(style?.spacingNonLinear),
    spacingLinear: clampSpacingLinear(style?.spacingLinear),
    systemMaxPerPage: paginate ? clampSystemsPerPage(style?.systemsPerPage) : 0,
    lyricSize: verovioLyricSize(lyricsScale),
    lyricTopMinMargin: 1.2,
    bottomMarginHeader: compact ? 1.5 : 2.0,
    pageMarginTop: compact ? 56 : 72,
    pageMarginBottom: 8,
    pageMarginLeft: 8,
    pageMarginRight: 8,
    noJustification: false,
    minLastJustification: 0,
    mnumInterval: 0,
    svgHtml5: true,
  }
}

export async function resolveScorePayload(input: {
  assetId?: string
  src?: string
}): Promise<ScorePayload> {
  if (input.assetId) {
    const asset = await getAsset(input.assetId)
    if (!asset) throw new Error('올린 악보 파일을 찾을 수 없습니다. 다시 올려 주세요.')
    const buffer = await asset.blob.arrayBuffer()
    if (isZipBuffer(buffer) || /\.mxl$/i.test(asset.name)) {
      return { kind: 'zip', buffer }
    }
    return { kind: 'xml', text: new TextDecoder('utf-8').decode(buffer) }
  }
  if (input.src) {
    const res = await fetch(input.src)
    if (!res.ok) throw new Error('악보 URL을 불러오지 못했습니다.')
    const buffer = await res.arrayBuffer()
    if (isZipBuffer(buffer) || /\.mxl$/i.test(input.src)) {
      return { kind: 'zip', buffer }
    }
    return { kind: 'xml', text: new TextDecoder('utf-8').decode(buffer) }
  }
  throw new Error('악보 소스가 없습니다.')
}

export function applyThemeToSvgRoot(root: HTMLElement, style?: ScoreStyle | null): void {
  const c = colorsForStyle(style)
  const font = getScoreFont(style?.fontId)
  const styleId = 'vrv-theme'
  root.querySelector(`#${styleId}`)?.remove()

  const el = document.createElement('style')
  el.id = styleId
  el.textContent = `
    svg { background: transparent !important; }
    .staff line, .staff path, .ledgerLines path, .ledgerLines line {
      stroke: ${c.music} !important;
      fill: none !important;
    }
    .barLine, .barLine path, .stem, .stem path, .tremolo, .vq {
      stroke: ${c.music} !important;
    }
    .barLine use {
      fill: ${c.music} !important;
      color: ${c.music} !important;
    }
    .notehead, .clef, .keySig, .keyAccid, .meterSig, .rest, .dots, .accid,
    .artic, .flag, .tie path, .slur path, .tupletNum, .beam {
      fill: ${c.music} !important;
      stroke: ${c.music} !important;
    }
    .tie, .slur, .phrase { stroke: ${c.music} !important; fill: none !important; }
    .verse text, .syl text, text.syl, .syl, .verse {
      fill: ${c.lyrics} !important;
      font-family: ${font.family} !important;
      font-weight: ${font.lyricsWeight} !important;
    }
    .harm text, .harm, .fb {
      fill: ${c.chord} !important;
      font-family: ${font.family} !important;
      font-weight: ${font.chordWeight} !important;
    }
    .pgHead text, .pgHead .text, .pgHead .rend, .pgFooter text {
      fill: ${c.title} !important;
      font-family: ${font.family} !important;
      font-weight: ${font.lyricsWeight} !important;
    }
    .mNum, .mNum text { display: none !important; }
  `
  const svg = root.querySelector('svg')
  if (svg) svg.prepend(el)
  else root.prepend(el)

  const titleScale = 1.4
  root.querySelectorAll('.pgHead [font-size]').forEach((node) => {
    const raw = node.getAttribute('font-size')
    if (!raw) return
    const n = Number.parseFloat(raw)
    if (!Number.isFinite(n) || n <= 0) return
    const unit = raw.replace(/[\d.+-eE]/g, '') || 'px'
    node.setAttribute('font-size', `${n * titleScale}${unit}`)
  })
}

function themeSvgHtml(svgHtml: string, style?: ScoreStyle | null): string {
  const wrap = document.createElement('div')
  wrap.innerHTML = svgHtml
  applyThemeToSvgRoot(wrap, style)
  return wrap.innerHTML
}

/** Verovio로 전 페이지 SVG를 만들어 캐시용으로 반환 */
export async function renderScorePages(input: ScoreRenderInput): Promise<ScorePageCache> {
  return withRenderLock(async () => {
    const toolkit = await getVerovioToolkit()
    const compact = Boolean(input.compact)
    const style = input.scoreStyle
    const payload = await resolveScorePayload(input)

    toolkit.setOptions(buildVerovioOptions(style, compact, 'none'))
    let loaded = false
    if (payload.kind === 'zip') {
      loaded = Boolean(toolkit.loadZipDataBuffer(payload.buffer))
    } else {
      loaded = Boolean(toolkit.loadData(payload.text))
    }
    if (!loaded) throw new Error('악보 데이터를 해석하지 못했습니다.')

    const sourceHint = payload.kind === 'xml' ? payload.text : ''
    const mei = toolkit.getMEI()
    const useLineBreaks = hasForcedSystemBreaks(sourceHint) || hasForcedSystemBreaks(mei)
    let workingMei = mei
    if (style?.staffFilter === 'treble') {
      workingMei = meiHideLowerStaves(workingMei)
    }

    toolkit.setOptions(
      buildVerovioOptions(style, compact, useLineBreaks ? 'line' : 'none', 'mei', useLineBreaks),
    )
    if (!toolkit.loadData(workingMei)) {
      throw new Error(useLineBreaks ? '줄바꿈 적용에 실패했습니다.' : '악보 재로드에 실패했습니다.')
    }

    const pageCount = Math.max(1, toolkit.getPageCount())
    const pages: string[] = []
    for (let p = 1; p <= pageCount; p += 1) {
      pages.push(themeSvgHtml(toolkit.renderToSVG(p), style))
    }
    return { pageCount, pages }
  })
}

export async function ensureScoreCached(input: ScoreRenderInput): Promise<ScorePageCache> {
  const key = makeScoreCacheKey(input)
  const hit = pageCache.get(key)
  if (hit) return hit
  const rendered = await renderScorePages(input)
  pageCache.set(key, rendered)
  return rendered
}

function scoreSlides(mass: MassSession): Slide[] {
  return mass.slides.filter(
    (s) =>
      s.mode === 'hymn-score' && Boolean(s.hymn?.musicXmlAssetId || s.hymn?.musicXmlUrl),
  )
}

/**
 * 슬라이드쇼 시작 전: WASM + 폰트 + 미사 안 모든 MusicXML을 SVG로 미리 판각.
 * toolkit 싱글톤이라 순차 처리.
 */
export async function preloadMassScores(
  mass: MassSession,
  onProgress?: (done: number, total: number, label: string) => void,
): Promise<void> {
  onProgress?.(0, 0, '악보 엔진 불러오는 중…')
  await getVerovioToolkit()

  const slides = scoreSlides(mass)
  const styles = [
    mass.scoreStyle,
    ...slides.map((s) => styleForSlide(s.scoreStyle, mass.scoreStyle)),
  ]

  onProgress?.(0, slides.length || 0, '가사 폰트 불러오는 중…')
  await ensureScoreFontsLoaded(styles)

  if (!slides.length) {
    onProgress?.(0, 0, '준비 완료')
    return
  }

  let done = 0
  for (const slide of slides) {
    const label = slide.label || slide.hymn?.title || '악보'
    onProgress?.(done, slides.length, `${label} 준비 중…`)
    const style = styleForSlide(slide.scoreStyle, mass.scoreStyle)
    await ensureScoreCached({
      assetId: slide.hymn?.musicXmlAssetId,
      src: slide.hymn?.musicXmlUrl,
      scoreStyle: style,
      compact: false,
    })
    done += 1
    onProgress?.(done, slides.length, `${label} 완료`)
  }
}
