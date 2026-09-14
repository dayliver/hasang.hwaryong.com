import type { MassSession } from '../types/mass'

/** 레이아웃·OSMD 확인용 샘플 — 이후 localStorage / 서버로 교체 */
export const sampleMasses: MassSession[] = [
  {
    id: 'taize-demo',
    title: '떼제 미사',
    kind: '떼제미사',
    scheduledAt: '2026-09-13T20:00:00',
    locationNote: '본당 · 어두운 조명',
    scoreTheme: 'dark',
    scoreStyle: {
      palette: 'candle',
      musicColor: '#8f877c',
      chordColor: '#a89f90',
      lyricsColor: '#f7f1e4',
      secondaryLyricsColor: '#c9c0b0',
    },
    slides: [
      {
        id: 't0',
        mode: 'image',
        label: '인트로',
        imageUrl: '/images/taize-intro.svg',
      },
      {
        id: 't1',
        mode: 'black',
        label: '블랙',
      },
      {
        id: 't2',
        mode: 'hymn-score',
        label: '입당',
        hymn: {
          number: 'T1',
          title: '주님을 기다리라',
          musicXmlUrl: '/scores/wait-for-the-lord.musicxml',
        },
      },
      {
        id: 't3',
        mode: 'black',
        label: '블랙',
      },
      {
        id: 't4',
        mode: 'hymn-score',
        label: '침묵 성가',
        hymn: {
          number: 'T2',
          title: '예수님 기억하소서',
          musicXmlUrl: '/scores/jesus-remember-me.musicxml',
        },
      },
      {
        id: 't5',
        mode: 'black',
        label: '블랙',
      },
      {
        id: 't6',
        mode: 'hymn-score',
        label: '찬미',
        hymn: {
          number: 'T3',
          title: '내 영혼아 주님을 찬미하여라',
          musicXmlUrl: '/scores/bless-the-lord.musicxml',
        },
      },
      {
        id: 't7',
        mode: 'black',
        label: '블랙',
      },
    ],
  },
  {
    id: 'sun-1100',
    title: '주일 11시 미사',
    kind: '주일미사',
    scheduledAt: '2026-09-14T11:00:00',
    locationNote: '본당',
    scoreTheme: 'light',
    slides: [
      {
        id: 's1',
        mode: 'title',
        label: '성정하상바울로성당',
        body: '주일 11시 미사\n성령강림 후 제24주일',
      },
      {
        id: 's2',
        mode: 'hymn-number',
        label: '입당송',
        hymn: { number: '42', title: '주님 어주시길' },
      },
      {
        id: 's3',
        mode: 'prayer',
        label: '참회기도',
        body: '전능하신 하느님과\n형제들에게 고백하오니\n생각과 말과 행위로\n죄를 많이 지었나이다.',
      },
      {
        id: 's4',
        mode: 'hymn-score',
        label: '대영광송',
        hymn: {
          number: '3',
          title: '대영광송',
          musicXmlUrl: '/scores/bless-the-lord.musicxml',
        },
      },
      {
        id: 's5',
        mode: 'order',
        label: '독서',
        body: '제1독서 · 화답송 · 제2독서 · 복음환호송 · 복음',
      },
      {
        id: 's6',
        mode: 'hymn-number',
        label: '봉헌성가',
        hymn: { number: '358', title: '주님께 바치오니' },
      },
      {
        id: 's7',
        mode: 'prayer',
        label: '성체성사',
        body: '이는 내 몸으로\n너희를 위하여 내어 주는 것이다.\n너희는 나를 기억하여\n이를 행하여라.',
      },
      {
        id: 's8',
        mode: 'hymn-number',
        label: '파견성가',
        hymn: { number: '302', title: '주님과 함께' },
      },
    ],
  },
  {
    id: 'weekday-0630',
    title: '평일 새벽 미사',
    kind: '평일미사',
    scheduledAt: '2026-09-15T06:30:00',
    locationNote: '본당',
    scoreTheme: 'light',
    slides: [
      {
        id: 'w1',
        mode: 'title',
        label: '성정하상바울로성당',
        body: '평일 새벽 미사',
      },
      {
        id: 'w2',
        mode: 'hymn-number',
        label: '입당송',
        hymn: { number: '21', title: '아침 찬미' },
      },
      {
        id: 'w3',
        mode: 'order',
        label: '말씀 전례',
        body: '독서 · 복음',
      },
      {
        id: 'w4',
        mode: 'hymn-number',
        label: '영성체성가',
        hymn: { number: '180', title: '생명의 빵' },
      },
    ],
  },
]
