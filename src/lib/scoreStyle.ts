import type { ScoreFontId, ScorePaletteId, ScoreStyle } from '../types/mass'
import { DEFAULT_SCORE_FONT_ID } from './scoreFonts'

export interface ScorePalette {
  id: ScorePaletteId
  label: string
  hint: string
  /** 코드·오선·음표 */
  music: string
  /** 코드 — 없으면 music과 동일 계열로 살짝 밝게 */
  chord: string
  /** 주 가사 */
  lyrics: string
  /** 보조·2절 가사 */
  secondaryLyrics: string
  title: string
  dark: boolean
}

export const SCORE_PALETTES: ScorePalette[] = [
  {
    id: 'candle',
    label: '촛불',
    hint: '은은한 오선 · 밝은 가사',
    music: '#8f877c',
    chord: '#a89f90',
    lyrics: '#f7f1e4',
    secondaryLyrics: '#c9c0b0',
    title: '#e8c57a',
    dark: true,
  },
  {
    id: 'ivory',
    label: '아이보리',
    hint: '가사 강조',
    music: '#7a746a',
    chord: '#9a9388',
    lyrics: '#fff8ea',
    secondaryLyrics: '#d4cbb8',
    title: '#f0d78c',
    dark: true,
  },
  {
    id: 'gold',
    label: '골드 가사',
    hint: '가사를 금색으로',
    music: '#75716c',
    chord: '#8f8a84',
    lyrics: '#e8c57a',
    secondaryLyrics: '#b89a55',
    title: '#e8c57a',
    dark: true,
  },
  {
    id: 'soft',
    label: '은은',
    hint: '전체 부드럽게',
    music: '#6a726c',
    chord: '#7e8780',
    lyrics: '#d5ddd6',
    secondaryLyrics: '#9aa69e',
    title: '#c9a24a',
    dark: true,
  },
  {
    id: 'light',
    label: '라이트',
    hint: '밝은 화면용',
    music: '#5a655e',
    chord: '#3d4740',
    lyrics: '#1c2b26',
    secondaryLyrics: '#5a6b64',
    title: '#6b5420',
    dark: false,
  },
]

export interface ResolvedScoreColors {
  music: string
  chord: string
  lyrics: string
  secondaryLyrics: string
  title: string
  dark: boolean
  paletteId: ScorePaletteId
}

export function getPalette(id: ScorePaletteId): ScorePalette {
  return SCORE_PALETTES.find((p) => p.id === id) ?? SCORE_PALETTES[0]!
}

function normalizeHex(hex: string | undefined, fallback: string): string {
  if (!hex) return fallback
  const raw = hex.trim()
  if (/^#[0-9a-fA-F]{6}$/.test(raw)) return raw.toLowerCase()
  if (/^#[0-9a-fA-F]{3}$/.test(raw)) {
    const r = raw.slice(1)
    return `#${r[0]}${r[0]}${r[1]}${r[1]}${r[2]}${r[2]}`.toLowerCase()
  }
  return fallback
}

/** 팔레트 + 사용자 지정 단색 (오파시티 없음) */
export function colorsForStyle(style?: ScoreStyle | null): ResolvedScoreColors {
  const paletteId = style?.palette ?? 'candle'
  const palette = getPalette(paletteId)
  const music = normalizeHex(style?.musicColor, palette.music)
  const lyrics = normalizeHex(style?.lyricsColor, palette.lyrics)
  return {
    paletteId,
    music,
    chord: normalizeHex(style?.chordColor, style?.musicColor ? music : palette.chord),
    lyrics,
    secondaryLyrics: normalizeHex(
      style?.secondaryLyricsColor,
      style?.lyricsColor ? lyrics : palette.secondaryLyrics,
    ),
    title: palette.title,
    dark: palette.dark,
  }
}

export function clampLyricsScale(value: number | undefined | null): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 1.25
  return Math.min(4, Math.max(0.8, Math.round(n * 20) / 20))
}

/** 기존 제목 보정(1.4)을 기본값으로 유지 */
export function clampTitleScale(value: number | undefined | null): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : 1.4
  return Math.min(4, Math.max(0.8, Math.round(n * 20) / 20))
}

/** Verovio 기본 0.6 근처 — 가사 가독용으로 살짝 완화한 기본값 */
export const DEFAULT_SPACING_NON_LINEAR = 0.55
/** Verovio 기본 0.25보다 타이트한 투사용 기본값 */
export const DEFAULT_SPACING_LINEAR = 0.1

export function clampSpacingNonLinear(value: number | undefined | null): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_SPACING_NON_LINEAR
  return Math.min(1, Math.max(0.15, Math.round(n * 100) / 100))
}

export function clampSpacingLinear(value: number | undefined | null): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_SPACING_LINEAR
  return Math.min(0.4, Math.max(0.02, Math.round(n * 100) / 100))
}

export const DEFAULT_SYSTEMS_PER_PAGE = 2

export function clampSystemsPerPage(value: number | undefined | null): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : DEFAULT_SYSTEMS_PER_PAGE
  return Math.min(4, Math.max(1, n))
}

/** Verovio 기본 2.0 — 투사용으로 이미 넓혀 둔 기본값 (Verovio 상한 8) */
export const DEFAULT_LYRIC_TOP_MIN_MARGIN = 8
/** Verovio lyricTopMinMargin 허용 상한. 초과분은 SVG에서 추가로 내린다. */
export const VEROVIO_LYRIC_TOP_MIN_MARGIN_MAX = 8

/** UI·저장용 (1~20). Verovio에는 min(value, 8)만 넘긴다. */
export function clampLyricTopMinMargin(value: number | undefined | null): number {
  const n =
    typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_LYRIC_TOP_MIN_MARGIN
  return Math.min(20, Math.max(1, Math.round(n * 2) / 2))
}

/** setOptions에 넣을 값 — 범위 밖이면 Verovio가 이전 값을 유지하므로 반드시 클램프 */
export function verovioLyricTopMinMargin(value: number | undefined | null): number {
  return Math.min(VEROVIO_LYRIC_TOP_MIN_MARGIN_MAX, clampLyricTopMinMargin(value))
}

/** Verovio 상한을 넘는 추가 간격 (MEI units) */
export function lyricTopMinMarginExtra(value: number | undefined | null): number {
  return Math.max(0, clampLyricTopMinMargin(value) - VEROVIO_LYRIC_TOP_MIN_MARGIN_MAX)
}

export function resolveScoreStyle(style?: ScoreStyle | null): Required<ScoreStyle> {
  const c = colorsForStyle(style)
  const fontId = (style?.fontId ?? DEFAULT_SCORE_FONT_ID) as ScoreFontId
  return {
    palette: c.paletteId,
    fontId,
    staffFilter: style?.staffFilter === 'treble' ? 'treble' : 'all',
    titleScale: clampTitleScale(style?.titleScale),
    lyricsScale: clampLyricsScale(style?.lyricsScale),
    spacingNonLinear: clampSpacingNonLinear(style?.spacingNonLinear),
    spacingLinear: clampSpacingLinear(style?.spacingLinear),
    systemsPerPage: clampSystemsPerPage(style?.systemsPerPage),
    lyricTopMinMargin: clampLyricTopMinMargin(style?.lyricTopMinMargin),
    musicColor: c.music,
    chordColor: c.chord,
    lyricsColor: c.lyrics,
    secondaryLyricsColor: c.secondaryLyrics,
  }
}

/** 슬라이드 스타일 → 없으면 미사 기본 → 앱 기본 */
export function styleForSlide(
  slideStyle?: ScoreStyle | null,
  massStyle?: ScoreStyle | null,
): Required<ScoreStyle> {
  return resolveScoreStyle(slideStyle ?? massStyle)
}

export function cloneResolvedScoreStyle(style?: ScoreStyle | null): ScoreStyle {
  return { ...resolveScoreStyle(style) }
}

export const DEFAULT_SCORE_STYLE: Required<ScoreStyle> = resolveScoreStyle({ palette: 'candle' })
