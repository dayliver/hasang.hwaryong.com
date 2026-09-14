import type { ScoreFontId } from '../types/mass'

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
