import type { ScoreFontId, ScoreStyle } from '../types/mass'

export type { ScoreFontId }

export interface ScoreFont {
  id: ScoreFontId
  label: string
  hint: string
  /** CSS font-family stack for OSMD / SVG text */
  family: string
  /** 주 가사 */
  lyricsWeight: string
  /** 보조·2절 가사 */
  secondaryWeight: string
  /** 코드(화성) */
  chordWeight: string
}

export const SCORE_FONTS: ScoreFont[] = [
  {
    id: 'pretendard',
    label: '프리텐다드',
    hint: '가변 산세리프 · 기본',
    family: '"Pretendard Variable", Pretendard, "Apple SD Gothic Neo", sans-serif',
    lyricsWeight: '650',
    secondaryWeight: '500',
    chordWeight: '300',
  },
  {
    id: 'a2z',
    label: '에이투지체',
    hint: '산세리프 · 9웨이트',
    family: '"A2ZFont", "Apple SD Gothic Neo", sans-serif',
    lyricsWeight: '600',
    secondaryWeight: '500',
    chordWeight: '300',
  },
  {
    id: 'gonggothic',
    label: '이사만루체',
    hint: '공고딕 · 제목·강조',
    family: '"GongGothic", "Apple SD Gothic Neo", sans-serif',
    lyricsWeight: '700',
    secondaryWeight: '500',
    chordWeight: '300',
  },
  {
    id: 'nps',
    label: '국민연금체',
    hint: '산세리프 · 가독성',
    family: '"NPSfont", "Apple SD Gothic Neo", sans-serif',
    lyricsWeight: '700',
    secondaryWeight: '400',
    chordWeight: '400',
  },
  {
    id: 'kimjungchul',
    label: '김정철명조',
    hint: '명조 · 기도·가사',
    family: '"KimjungchulMyungjo", "Apple SD Gothic Neo", serif',
    lyricsWeight: '700',
    secondaryWeight: '400',
    chordWeight: '300',
  },
  {
    id: 'gapyeong',
    label: '가평 한석봉 큰붓',
    hint: '붓글씨 · 표지·강조',
    family: '"GapyeongHanseokbong", "Apple SD Gothic Neo", serif',
    lyricsWeight: '700',
    secondaryWeight: '400',
    chordWeight: '300',
  },
  {
    id: 'shilla',
    label: '신라문화체',
    hint: '고전체 · Medium/Bold',
    family: '"Shilla", "Apple SD Gothic Neo", serif',
    lyricsWeight: '700',
    secondaryWeight: '500',
    chordWeight: '500',
  },
  {
    id: 'sejong',
    label: '세종학당체',
    hint: '손글씨 바탕 · Regular/Bold',
    family: '"KingSejongInstitute", "Apple SD Gothic Neo", serif',
    lyricsWeight: '700',
    secondaryWeight: '400',
    chordWeight: '400',
  },
  {
    id: 'gangwon',
    label: '강원교육모두체',
    hint: '손글씨 명조 · Light/Bold',
    family: '"GangwonEducationModuche", "Apple SD Gothic Neo", serif',
    lyricsWeight: '700',
    secondaryWeight: '300',
    chordWeight: '300',
  },
]

export const DEFAULT_SCORE_FONT_ID: ScoreFontId = 'pretendard'

export function getScoreFont(id?: ScoreFontId | null): ScoreFont {
  return SCORE_FONTS.find((f) => f.id === id) ?? SCORE_FONTS[0]!
}

/** CSS stack에서 첫 번째 실제 패밀리 이름 */
export function cssFontFamilyName(familyStack: string): string {
  const m = familyStack.match(/"([^"]+)"|'([^']+)'|([^,\s]+)/)
  return (m?.[1] || m?.[2] || m?.[3] || 'sans-serif').trim()
}

/** 악보에 쓰일 폰트·웨이트를 document.fonts 로 미리 로드 (FOUT 방지) */
export async function ensureScoreFontsLoaded(
  styles: Array<ScoreStyle | null | undefined>,
): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts?.load) return

  const byFamily = new Map<string, Set<string>>()
  for (const style of styles) {
    const font = getScoreFont(style?.fontId)
    const name = cssFontFamilyName(font.family)
    let weights = byFamily.get(name)
    if (!weights) {
      weights = new Set()
      byFamily.set(name, weights)
    }
    weights.add(font.lyricsWeight)
    weights.add(font.secondaryWeight)
    weights.add(font.chordWeight)
  }

  const loads: Promise<unknown>[] = []
  for (const [name, weights] of byFamily) {
    for (const weight of weights) {
      loads.push(
        document.fonts.load(`${weight} 64px "${name}"`).catch(() => undefined),
      )
    }
  }
  await Promise.all(loads)
  // 브라우저가 로드 반영할 한 프레임
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
}
