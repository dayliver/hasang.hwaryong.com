/** 슬라이드 표시 방식 */
export type SlideMode =
  | 'prayer'
  | 'hymn-number'
  | 'hymn-score'
  | 'order'
  | 'title'
  | 'black'
  | 'image'

/** 미사 종류 */
export type MassKind =
  | '주일미사'
  | '평일미사'
  | '특전미사'
  | '혼인미사'
  | '장례미사'
  | '떼제미사'
  | '기타'

/** 악보·투사 테마 (어두운 성당용 dark 기본) */
export type ScoreTheme = 'dark' | 'light'

export type ScorePaletteId = 'candle' | 'ivory' | 'gold' | 'soft' | 'light'

export type ScoreFontId =
  | 'pretendard'
  | 'a2z'
  | 'gonggothic'
  | 'nps'
  | 'kimjungchul'
  | 'gapyeong'
  | 'shilla'
  | 'sejong'
  | 'gangwon'

/** 4성부 등에서 표시할 성부 범위 */
export type ScoreStaffFilter = 'all' | 'treble'

/**
 * 악보 표시 스타일 (미사 기본값 + 슬라이드별 오버라이드)
 * - musicColor: 코드 + 오선·음표
 * - lyricsColor: 주 가사 + 보조/2절 가사
 * - chordColor / secondaryLyricsColor: 선택적 세부 지정
 * - spacing*: Verovio 가로 간격 (시가 대비·전체 밀도)
 */
export interface ScoreStyle {
  palette?: ScorePaletteId
  /** 가사·코드 폰트 */
  fontId?: ScoreFontId
  /** all=전체, treble=윗줄(트레블)만 — 베이스/아랫줄 숨김 */
  staffFilter?: ScoreStaffFilter
  /**
   * 제목(pgHead) 크기 배율. 기본 1.4 (기존 Verovio 제목 보정).
   * 대략 0.8~4
   */
  titleScale?: number
  /**
   * 가사 크기 배율 (1 = 기본). 대략 0.8~4
   * Verovio lyricSize 상한(8)을 넘는 구간은 SVG에서 추가 확대합니다.
   */
  lyricsScale?: number
  /**
   * Verovio spacingNonLinear (0~1).
   * 1에 가까울수록 시가 그대로 비례, 낮을수록 긴·짧은 음 칸 차이 완화.
   */
  spacingNonLinear?: number
  /**
   * Verovio spacingLinear (0~1).
   * 높을수록 전체 가로로 더 넓게.
   */
  spacingLinear?: number
  /**
   * 한 화면에 보일 시스템(줄) 수. 기본 2.
   * MusicXML에 줄바꿈이 있을 때만 페이지로 나뉩니다.
   */
  systemsPerPage?: number
  /** 오선·음표·쉼표 색 (#rrggbb) */
  musicColor?: string
  /** 코드(화성) 색 — 없으면 musicColor */
  chordColor?: string
  /** 주 가사 색 */
  lyricsColor?: string
  /** 보조·2절 가사 색 — 없으면 lyricsColor보다 살짝 톤 다운 */
  secondaryLyricsColor?: string
}

export interface HymnRef {
  number: string
  title: string
  musicXmlAssetId?: string
  musicXmlFileName?: string
  musicXmlUrl?: string
  scoreAssetId?: string
  scoreFileName?: string
  scoreUrl?: string
}

export interface Slide {
  id: string
  mode: SlideMode
  label: string
  body?: string
  hymn?: HymnRef
  /** 악보 슬라이드별 스타일 — 없으면 mass.scoreStyle 사용 */
  scoreStyle?: ScoreStyle
  imageAssetId?: string
  imageFileName?: string
  imageUrl?: string
  notes?: string
}

export interface MassSession {
  id: string
  title: string
  kind: MassKind
  scheduledAt: string
  locationNote?: string
  scoreTheme?: ScoreTheme
  scoreStyle?: ScoreStyle
  slides: Slide[]
}

export const SLIDE_MODE_LABEL: Record<SlideMode, string> = {
  prayer: '기도문',
  'hymn-number': '성가 번호',
  'hymn-score': '성가 악보',
  order: '식순',
  title: '표지',
  black: '블랙',
  image: '이미지',
}
