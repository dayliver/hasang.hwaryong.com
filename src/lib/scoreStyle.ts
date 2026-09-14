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
  return Math.min(1.8, Math.max(0.8, Math.round(n * 20) / 20))
}

export function resolveScoreStyle(style?: ScoreStyle | null): Required<ScoreStyle> {
  const c = colorsForStyle(style)
  const fontId = (style?.fontId ?? DEFAULT_SCORE_FONT_ID) as ScoreFontId
  return {
    palette: c.paletteId,
    fontId,
    staffFilter: style?.staffFilter === 'treble' ? 'treble' : 'all',
    lyricsScale: clampLyricsScale(style?.lyricsScale),
    musicColor: c.music,
    chordColor: c.chord,
    lyricsColor: c.lyrics,
    secondaryLyricsColor: c.secondaryLyrics,
  }
}

export const DEFAULT_SCORE_STYLE: Required<ScoreStyle> = resolveScoreStyle({ palette: 'candle' })
