import { reactive, watch } from 'vue'
import type { MassSession, Slide } from '../types/mass'
import { SLIDE_MODE_LABEL } from '../types/mass'
import { sampleMasses } from '../data/sample'
import { deleteAsset } from '../lib/assetStore'
import { cloneResolvedScoreStyle } from '../lib/scoreStyle'

type MassPatch = Partial<
  Pick<MassSession, 'title' | 'kind' | 'scheduledAt' | 'locationNote' | 'scoreTheme' | 'scoreStyle'>
>

const STORAGE_KEY = 'hasang-masses-v1'

function cloneMasses(): MassSession[] {
  return structuredClone(sampleMasses)
}

function loadMasses(): MassSession[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return cloneMasses()
    const parsed = JSON.parse(raw) as MassSession[]
    if (!Array.isArray(parsed) || parsed.length === 0) return cloneMasses()
    return parsed
  } catch {
    return cloneMasses()
  }
}

function persist() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.masses))
  } catch (err) {
    console.warn('[mass store] 저장 실패', err)
  }
}

const state = reactive({
  masses: loadMasses() as MassSession[],
})

watch(
  () => state.masses,
  () => persist(),
  { deep: true },
)

/** 목록에서 가장 뒤에 있는 악보 슬라이드의 스타일 (없으면 미사 기본) */
function lastScoreStyleSeed(mass: MassSession) {
  for (let i = mass.slides.length - 1; i >= 0; i -= 1) {
    const s = mass.slides[i]!
    if (s.mode !== 'hymn-score') continue
    return cloneResolvedScoreStyle(s.scoreStyle ?? mass.scoreStyle)
  }
  return cloneResolvedScoreStyle(mass.scoreStyle)
}

export function useMassStore() {
  function list() {
    return state.masses
  }

  function getById(id: string): MassSession | undefined {
    return state.masses.find((m) => m.id === id)
  }

  function updateSlides(id: string, slides: Slide[]) {
    const mass = getById(id)
    if (!mass) return
    mass.slides = slides
  }

  function moveSlide(id: string, from: number, to: number) {
    const mass = getById(id)
    if (!mass) return
    if (to < 0 || to >= mass.slides.length) return
    const [item] = mass.slides.splice(from, 1)
    mass.slides.splice(to, 0, item)
  }

  function newSlideId() {
    return `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  }

  function createBlankSlide(mode: Slide['mode'], mass?: MassSession): Slide {
    const label = SLIDE_MODE_LABEL[mode] ?? '슬라이드'
    const slide: Slide = {
      id: newSlideId(),
      mode,
      label,
    }
    if (mode === 'hymn-number' || mode === 'hymn-score') {
      slide.hymn = { number: '', title: '' }
    }
    if (mode === 'hymn-score' && mass) {
      slide.scoreStyle = lastScoreStyleSeed(mass)
    }
    if (mode === 'prayer' || mode === 'order' || mode === 'title') {
      slide.body = ''
    }
    return slide
  }

  /** afterIndex: 이 인덱스 뒤에 삽입. -1이면 맨 앞, undefined면 맨 끝 */
  function addSlide(id: string, mode: Slide['mode'], afterIndex?: number): Slide | undefined {
    const mass = getById(id)
    if (!mass) return
    const slide = createBlankSlide(mode, mass)
    const at =
      afterIndex === undefined
        ? mass.slides.length
        : Math.min(Math.max(afterIndex + 1, 0), mass.slides.length)
    mass.slides.splice(at, 0, slide)
    return slide
  }

  function duplicateSlide(id: string, slideId: string): Slide | undefined {
    const mass = getById(id)
    if (!mass) return
    const idx = mass.slides.findIndex((s) => s.id === slideId)
    if (idx < 0) return
    const copy = JSON.parse(JSON.stringify(mass.slides[idx])) as Slide
    copy.id = newSlideId()
    copy.label = `${copy.label} 복사`
    mass.slides.splice(idx + 1, 0, copy)
    return copy
  }

  function removeSlide(id: string, slideId: string): boolean {
    const mass = getById(id)
    if (!mass) return false
    if (mass.slides.length <= 1) return false
    const idx = mass.slides.findIndex((s) => s.id === slideId)
    if (idx < 0) return false
    mass.slides.splice(idx, 1)
    return true
  }

  function updateSlide(id: string, slideId: string, patch: Partial<Slide>) {
    const mass = getById(id)
    if (!mass) return
    const slide = mass.slides.find((s) => s.id === slideId)
    if (!slide) return
    Object.assign(slide, patch)
  }

  function updateMass(id: string, patch: MassPatch) {
    const mass = getById(id)
    if (!mass) return
    Object.assign(mass, patch)
  }

  async function replaceSlideAsset(
    massId: string,
    slideId: string,
    field: 'musicXml' | 'scoreImage' | 'image',
    next: { id: string; name: string } | null,
  ) {
    const mass = getById(massId)
    if (!mass) return
    const slide = mass.slides.find((s) => s.id === slideId)
    if (!slide) return

    if (field === 'image') {
      const prev = slide.imageAssetId
      if (next) {
        slide.imageAssetId = next.id
        slide.imageFileName = next.name
        slide.imageUrl = undefined
      } else {
        slide.imageAssetId = undefined
        slide.imageFileName = undefined
      }
      if (prev && prev !== next?.id) void deleteAsset(prev)
      return
    }

    const hymn = {
      number: slide.hymn?.number ?? '',
      title: slide.hymn?.title ?? '',
      musicXmlAssetId: slide.hymn?.musicXmlAssetId,
      musicXmlFileName: slide.hymn?.musicXmlFileName,
      musicXmlUrl: slide.hymn?.musicXmlUrl,
      scoreAssetId: slide.hymn?.scoreAssetId,
      scoreFileName: slide.hymn?.scoreFileName,
      scoreUrl: slide.hymn?.scoreUrl,
    }

    if (field === 'musicXml') {
      const prev = hymn.musicXmlAssetId
      if (next) {
        hymn.musicXmlAssetId = next.id
        hymn.musicXmlFileName = next.name
        hymn.musicXmlUrl = undefined
      } else {
        hymn.musicXmlAssetId = undefined
        hymn.musicXmlFileName = undefined
      }
      if (prev && prev !== next?.id) void deleteAsset(prev)
    } else {
      const prev = hymn.scoreAssetId
      if (next) {
        hymn.scoreAssetId = next.id
        hymn.scoreFileName = next.name
        hymn.scoreUrl = undefined
      } else {
        hymn.scoreAssetId = undefined
        hymn.scoreFileName = undefined
      }
      if (prev && prev !== next?.id) void deleteAsset(prev)
    }

    slide.hymn = hymn
  }

  function reset() {
    state.masses = cloneMasses()
  }

  /** 브라우저에 사용자가 저장한 미사가 있는지 (샘플만이면 false) */
  function hasPersistedMasses(): boolean {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return false
      const parsed = JSON.parse(raw) as unknown
      return Array.isArray(parsed) && parsed.length > 0
    } catch {
      return false
    }
  }

  function replaceAllMasses(masses: MassSession[]) {
    state.masses = JSON.parse(JSON.stringify(masses)) as MassSession[]
  }

  /** 같은 id면 교체, 없으면 추가 */
  function upsertMasses(masses: MassSession[]) {
    for (const incoming of masses) {
      const copy = JSON.parse(JSON.stringify(incoming)) as MassSession
      const idx = state.masses.findIndex((m) => m.id === copy.id)
      if (idx >= 0) state.masses[idx] = copy
      else state.masses.push(copy)
    }
  }

  return {
    list,
    getById,
    updateSlides,
    moveSlide,
    addSlide,
    duplicateSlide,
    removeSlide,
    updateSlide,
    updateMass,
    replaceSlideAsset,
    reset,
    hasPersistedMasses,
    replaceAllMasses,
    upsertMasses,
  }
}
