<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ScoreStyle } from '../types/mass'
import type { OpenSheetMusicDisplay as OsmdType } from 'opensheetmusicdisplay'
import { getAsset } from '../lib/assetStore'
import { getScoreFont } from '../lib/scoreFonts'
import { colorsForStyle, clampLyricsScale } from '../lib/scoreStyle'

const props = withDefaults(
  defineProps<{
    src?: string
    assetId?: string
    scoreStyle?: ScoreStyle | null
    compact?: boolean
  }>(),
  {
    compact: false,
  },
)

const wrap = ref<HTMLElement | null>(null)
const host = ref<HTMLElement | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const errorMessage = ref('')
const fitStyle = ref<Record<string, string>>({})
const hostStyle = ref<Record<string, string>>({})

const hasSource = computed(() => Boolean(props.assetId || props.src))
const colors = computed(() => colorsForStyle(props.scoreStyle))
const scoreFont = computed(() => getScoreFont(props.scoreStyle?.fontId))

let osmd: OsmdType | null = null
let renderToken = 0
let blobUrlToRevoke: string | null = null
let resizeObserver: ResizeObserver | null = null

function buildOptions() {
  const c = colors.value
  return {
    autoResize: false,
    backend: 'svg' as const,
    darkMode: false,
    pageBackgroundColor: '#00000000',
    disableCursor: true,
    renderSingleHorizontalStaffline: false,
    pageFormat: 'Endless',
    stretchLastSystemLine: true,
    newSystemFromXML: false,
    drawingParameters: 'compacttight' as const,
    drawTitle: true,
    drawSubtitle: false,
    drawComposer: false,
    drawLyricist: false,
    drawPartNames: false,
    drawMeasureNumbers: false,
    drawMetronomeMarks: false,
    defaultFontFamily: scoreFont.value.family,
    // 전역 Bold는 코드까지 두꺼워져서, 가사는 렌더 후 weight로 따로 올림
    defaultFontStyle: 0, // FontStyles.Regular
    defaultColorMusic: c.music,
    defaultColorRest: c.music,
    defaultColorLabel: c.lyrics,
    defaultColorTitle: c.title,
  }
}

function applyEngravingColors(instance: OsmdType) {
  const c = colors.value
  instance.setOptions(buildOptions())
  const rules = instance.EngravingRules
  rules.applyDefaultColorMusic(c.music)
  rules.DefaultColorLyrics = c.lyrics
  rules.DefaultColorChordSymbol = c.chord
  rules.DefaultColorLabel = c.lyrics
  rules.DefaultColorTitle = c.title
  rules.StaffLineColor = c.music
  rules.LedgerLineColorDefault = c.music

  rules.TitleTopDistance = props.compact ? 0.6 : 1.0
  rules.PageTopMargin = props.compact ? 1.5 : 2.2

  // 가사 크기 (사용자 lyricsScale) · 코드는 상대적으로 작게
  const lyricsScale = clampLyricsScale(props.scoreStyle?.lyricsScale)
  rules.LyricsHeight = (props.compact ? 1.9 : 2.15) * lyricsScale
  rules.ChordSymbolTextHeight = props.compact ? 1.35 : 1.5
  rules.ChordSymbolBottomMargin = props.compact ? 0.35 : 0.55
  // 가사가 커지면 제목↔악보·가사 여백도 조금 늘림
  rules.TitleBottomDistance = (props.compact ? 2.8 : 4.2) * Math.max(1, lyricsScale * 0.85)
  rules.LyricsYMarginToBottomLine = Math.max(0.2, 0.25 * lyricsScale)

  // 오선·선 더 가늘게 (화면 보정 전 판각 값)
  rules.StaffLineWidth = 0.022
  rules.LedgerLineWidth = 0.028
  rules.StemWidth = 0.065
  rules.SystemThinLineWidth = 0.04
  rules.SystemBoldLineWidth = 0.16
  rules.SystemRepetitionEndingLineWidth = 0.05
  rules.WedgeLineWidth = 0.05
  rules.TupletLineWidth = 0.05
  rules.LyricUnderscoreLineWidth = 0.04
  rules.GraceLineWidth = 0.05
  rules.BeamWidth = 0.38
}

/**
 * 성부 필터: treble이면 베이스/아랫줄(및 남성부 파트)을 숨기고 윗줄만 남김.
 * - 한 파트에 오선 2줄(그랜드 스태프): 아랫줄 Visible=false
 * - 파트가 여러 개(SA/TB 또는 SATB): 아래쪽 절반 파트를 숨김
 */
function applyStaffFilter(instance: OsmdType) {
  const filter = props.scoreStyle?.staffFilter ?? 'all'
  const instruments = instance.Sheet?.Instruments ?? []
  if (!instruments.length) return

  for (const inst of instruments) {
    inst.Visible = true
    for (const staff of inst.Staves ?? []) {
      staff.Visible = true
    }
  }

  if (filter !== 'treble') return

  let hidStaffInGrand = false
  for (const inst of instruments) {
    const staves = inst.Staves ?? []
    if (staves.length < 2) continue
    for (let i = 1; i < staves.length; i++) {
      staves[i]!.Visible = false
      hidStaffInGrand = true
    }
  }
  if (hidStaffInGrand) return

  if (instruments.length >= 2) {
    const keep = Math.ceil(instruments.length / 2)
    for (let i = keep; i < instruments.length; i++) {
      instruments[i]!.Visible = false
    }
  }
}

/** 가사/코드 색 + 굵기 (폰트별 weight) */
function applyLabelTypography(instance: OsmdType) {
  const c = colors.value
  const font = scoreFont.value
  try {
    for (const page of instance.GraphicSheet?.MusicPages ?? []) {
      for (const system of page.MusicSystems ?? []) {
        for (const staffLine of system.StaffLines ?? []) {
          for (const measure of staffLine.Measures ?? []) {
            for (const se of measure.staffEntries ?? []) {
              for (const le of se.LyricsEntries ?? []) {
                const entry = le.LyricsEntry
                const verse = String(entry.VerseNumber ?? '1')
                const isSecondary =
                  entry.IsTranslation || (verse !== '1' && verse !== '0' && verse !== '')
                const color = isSecondary ? c.secondaryLyrics : c.lyrics
                const weight = isSecondary ? font.secondaryWeight : font.lyricsWeight
                styleTextNode(le.GraphicalLabel?.SVGNode, { color, weight, family: font.family })
                if (le.GraphicalLabel?.Label) {
                  le.GraphicalLabel.Label.colorDefault = color
                  le.GraphicalLabel.Label.fontStyle = 1 // Bold
                }
              }
              for (const chord of se.graphicalChordContainers ?? []) {
                styleTextNode(chord.GraphicalLabel?.SVGNode, {
                  color: c.chord,
                  weight: font.chordWeight,
                  family: font.family,
                })
                if (chord.GraphicalLabel?.Label) {
                  chord.GraphicalLabel.Label.colorDefault = c.chord
                  chord.GraphicalLabel.Label.fontStyle = 0
                }
              }
            }
          }
          for (const dash of staffLine.LyricsDashes ?? []) {
            styleTextNode(dash?.SVGNode, {
              color: c.lyrics,
              weight: font.lyricsWeight,
              family: font.family,
            })
          }
        }
      }
    }
  } catch (err) {
    console.warn('[OsmdScore] label typography', err)
  }
}

function styleTextNode(
  node: Node | undefined | null,
  opts: { color: string; weight: string; family: string },
) {
  if (!node || !(node instanceof Element)) return
  const paint = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'text' || tag === 'tspan') {
      el.setAttribute('font-weight', opts.weight)
      el.setAttribute('font-family', opts.family)
      ;(el as SVGElement).style.fontWeight = opts.weight
      ;(el as SVGElement).style.fontFamily = opts.family
    }
    const f = el.getAttribute('fill')
    if (!f || f === 'none') {
      el.setAttribute('fill', opts.color)
    } else if (f !== 'none') {
      el.setAttribute('fill', opts.color)
    }
    const s = el.getAttribute('stroke')
    if (s && s !== 'none') el.setAttribute('stroke', opts.color)
  }
  paint(node)
  node.querySelectorAll('*').forEach((child) => paint(child))
}

/** OSMD가 깐 불투명 배경 rect 제거 → 슬라이드 배경과 자연스럽게 */
function clearSvgBackground(root: HTMLElement) {
  const svg = root.querySelector('svg')
  if (!svg) return
  svg.style.background = 'transparent'
  svg.querySelectorAll('rect').forEach((rect) => {
    const fill = (rect.getAttribute('fill') || '').toLowerCase()
    const hasStroke = rect.hasAttribute('stroke') && rect.getAttribute('stroke') !== 'none'
    if (hasStroke) return
    if (
      !fill ||
      fill === 'none' ||
      fill === '#000' ||
      fill === '#000000' ||
      fill === 'black' ||
      fill.startsWith('#000000') ||
      fill === '#ffffff' ||
      fill === 'white' ||
      fill === '#fff'
    ) {
      // 전체 페이지 배경으로 보이는 큰 rect만
      const w = Number(rect.getAttribute('width') || 0)
      const h = Number(rect.getAttribute('height') || 0)
      if (w > 100 || h > 100 || !rect.getAttribute('width')) {
        rect.setAttribute('fill', 'none')
        ;(rect as SVGRectElement).style.fill = 'none'
      }
    }
  })
}

function revokeBlob() {
  if (blobUrlToRevoke) {
    URL.revokeObjectURL(blobUrlToRevoke)
    blobUrlToRevoke = null
  }
}

async function resolveLoadTarget(): Promise<string | null> {
  revokeBlob()
  if (props.assetId) {
    const asset = await getAsset(props.assetId)
    if (!asset) throw new Error('올린 악보 파일을 찾을 수 없습니다. 다시 올려 주세요.')
    blobUrlToRevoke = URL.createObjectURL(asset.blob)
    return blobUrlToRevoke
  }
  if (props.src) return props.src
  return null
}

function baseEngravingWidthPx(): number {
  return props.compact ? 520 : 820
}

function countSystems(instance: OsmdType): number {
  try {
    const pages = instance.GraphicSheet?.MusicPages
    if (!pages?.length) return 0
    return pages.reduce((sum, page) => sum + (page.MusicSystems?.length ?? 0), 0)
  } catch {
    return 0
  }
}

/** 한 시스템에 오선이 몇 줄인지 (4성부 SATB ≈ 2) */
function countMaxStaffLines(instance: OsmdType): number {
  try {
    let max = 0
    for (const page of instance.GraphicSheet?.MusicPages ?? []) {
      for (const system of page.MusicSystems ?? []) {
        max = Math.max(max, system.StaffLines?.length ?? 0)
      }
    }
    return max
  } catch {
    return 0
  }
}

function countSourceMeasures(instance: OsmdType): number {
  try {
    return instance.Sheet?.SourceMeasures?.length ?? 0
  } catch {
    return 0
  }
}

/**
 * 다성부: 윗줄·아랫줄에 비슷한 양의 가사가 가도록 마디 수를 고른다.
 * (한 줄에 더 욱여넣는 것이 아니라, 균형 있게 끊는다)
 */
function chooseBalancedMeasuresPerLine(total: number): number {
  if (total <= 3) return 0 // 자동(한 줄)
  const targetSystems = total >= 22 ? 4 : total >= 14 ? 3 : 2
  const base = Math.ceil(total / targetSystems)
  const candidates = new Set<number>([base, base - 1, base + 1, 4, 3, 2])
  let best = base
  let bestScore = Number.POSITIVE_INFINITY
  for (const c of candidates) {
    if (c < 2 || c > total) continue
    const systems = Math.ceil(total / c)
    const last = total - c * (systems - 1)
    const balance = Math.abs(c - last)
    const systemPenalty = Math.abs(systems - targetSystems) * 2
    const evenBonus = c % 2 === 0 ? -0.4 : 0
    const fourBonus = c % 4 === 0 ? -0.6 : 0
    const score = balance + systemPenalty + evenBonus + fourBonus
    if (score < bestScore) {
      bestScore = score
      best = c
    }
  }
  return best
}

function applyLyricSpacingRules(
  instance: OsmdType,
  opts: { multiStaff: boolean; measuresPerLine: number },
) {
  const rules = instance.EngravingRules
  rules.LyricsUseXPaddingForLongLyrics = true
  rules.MaximumLyricsElongationFactor = opts.multiStaff ? 3.6 : 2.4
  rules.BetweenSyllableMinimumDistance = opts.multiStaff ? 0.6 : 0.35
  rules.HorizontalBetweenLyricsDistance = opts.multiStaff ? 0.5 : 0.3
  // 음표 사이 기본 간격 (마디를 더 넣는 게 아니라 사이가 벌어짐)
  rules.VoiceSpacingMultiplierVexflow = opts.multiStaff ? 1.45 : 1
  rules.VoiceSpacingAddendVexflow = opts.multiStaff ? 1.2 : 0
  rules.SheetMaximumWidth = 5000
  // 0 = OSMD 자동 줄바꿈
  rules.RenderXMeasuresPerLineAkaSystem = opts.measuresPerLine
  rules.StretchLastSystemLine = true
}

/** 마디당 판각 폭 — 클수록 음표·가사 사이가 넓어짐 (줄에 마디를 더 넣지 않음) */
function engravingWidthForMeasures(measuresPerLine: number, multiStaff: boolean): number {
  const base = baseEngravingWidthPx()
  if (!multiStaff || measuresPerLine <= 0) return base
  const pxPerMeasure = props.compact ? 210 : 300
  const margin = props.compact ? 70 : 100
  const maxWidth = props.compact ? 1100 : 1680
  return Math.min(maxWidth, Math.max(base, measuresPerLine * pxPerMeasure + margin))
}

function readSvgSize(svg: SVGSVGElement): { w: number; h: number } {
  const attrW = Number(svg.getAttribute('width'))
  const attrH = Number(svg.getAttribute('height'))
  if (attrW > 0 && attrH > 0) return { w: attrW, h: attrH }
  try {
    const box = svg.getBBox()
    if (box.width > 0 && box.height > 0) return { w: box.width, h: box.height }
  } catch {
    /* empty svg */
  }
  return { w: baseEngravingWidthPx(), h: 240 }
}

function fitUniform() {
  const wrapEl = wrap.value
  const hostEl = host.value
  const svg = hostEl?.querySelector('svg') as SVGSVGElement | null
  if (!wrapEl || !hostEl || !svg) return

  const { w: svgW, h: svgH } = readSvgSize(svg)
  const pad = props.compact ? 0.9 : 0.93
  const availW = Math.max(wrapEl.clientWidth, 1) * pad
  const availH = Math.max(wrapEl.clientHeight, 1) * pad

  const maxScale = props.compact ? 1.45 : 3.4
  const scale = Math.min(availW / svgW, availH / svgH, maxScale)

  const fitW = Math.ceil(svgW * scale)
  const fitH = Math.ceil(svgH * scale)

  fitStyle.value = {
    width: `${fitW}px`,
    height: `${fitH}px`,
  }
  hostStyle.value = {
    width: `${svgW}px`,
    height: `${svgH}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }

  // CSS로 확대해도 오선은 화면상 ~1px 유지
  pinStaffLinesToOneScreenPixel(svg)
}

/**
 * 긴 가로 stroke(=오선·가선)을 화면 ~0.7px로 고정.
 * 확대해도 굵어지지 않음.
 */
function pinStaffLinesToOneScreenPixel(svg: SVGSVGElement) {
  const hairline = '0.7'
  const mark = (el: Element) => {
    el.setAttribute('vector-effect', 'non-scaling-stroke')
    el.setAttribute('stroke-width', hairline)
    const s = el as SVGElement
    s.style.vectorEffect = 'non-scaling-stroke'
    s.style.strokeWidth = `${hairline}px`
  }

  svg.querySelectorAll('line').forEach((el) => {
    const stroke = el.getAttribute('stroke')
    if (!stroke || stroke === 'none') return
    const sw = Number(el.getAttribute('stroke-width') || '1')
    if (sw <= 0 || sw > 3) return
    const y1 = Number(el.getAttribute('y1'))
    const y2 = Number(el.getAttribute('y2'))
    const x1 = Number(el.getAttribute('x1'))
    const x2 = Number(el.getAttribute('x2'))
    // 오선(긴 가로) + 가선(짧은 가로)
    if (Math.abs(y1 - y2) < 0.75 && Math.abs(x2 - x1) > 8) mark(el)
  })

  svg.querySelectorAll('path').forEach((el) => {
    const stroke = el.getAttribute('stroke')
    if (!stroke || stroke === 'none') return
    const fill = el.getAttribute('fill')
    if (fill && fill !== 'none') return
    const sw = Number(el.getAttribute('stroke-width') || '1')
    if (sw <= 0 || sw > 3) return
    const d = (el.getAttribute('d') || '').replace(/,/g, ' ').trim()
    const m = d.match(
      /^M\s*([-\d.]+)\s+([-\d.]+)\s*(?:L\s*([-\d.]+)\s+([-\d.]+)|H\s*([-\d.]+))\s*$/i,
    )
    if (!m) return
    const x1 = Number(m[1])
    const y1 = Number(m[2])
    const y2 = m[4] != null ? Number(m[4]) : y1
    const x2 = m[5] != null ? Number(m[5]) : Number(m[3])
    if (Math.abs(y1 - y2) < 0.75 && Math.abs(x2 - x1) > 8) mark(el)
  })
}

/**
 * OSMD로 판각을 다시 짠다 (SVG 좌우 stretch 금지).
 * - 단성부: 단이 너무 많으면 폭만 조금 넓혀 2단 근처로
 * - 다성부(4성부 등): 윗줄·아랫줄 마디를 균형 있게 끊고,
 *   같은 마디 수 안에서 음표 간격을 넓혀 가사가 숨 쉬게 함
 */
function renderEngravedLayout(instance: OsmdType) {
  if (!host.value) return

  const zoom = props.compact ? 0.72 : 0.98

  const paint = (w: number, multiStaff: boolean, measuresPerLine: number) => {
    host.value!.style.width = `${Math.round(w)}px`
    applyStaffFilter(instance)
    applyEngravingColors(instance)
    applyLyricSpacingRules(instance, { multiStaff, measuresPerLine })
    instance.zoom = zoom
    instance.render()
    clearSvgBackground(host.value!)
    applyLabelTypography(instance)
  }

  // 1차 — 성부·마디 수 파악
  paint(baseEngravingWidthPx(), false, 0)

  const staffLines = countMaxStaffLines(instance)
  const multiStaff = staffLines >= 2
  const totalMeasures = countSourceMeasures(instance)

  if (multiStaff) {
    const measuresPerLine = chooseBalancedMeasuresPerLine(totalMeasures)
    const width = engravingWidthForMeasures(
      measuresPerLine > 0 ? measuresPerLine : Math.max(totalMeasures, 1),
      true,
    )
    paint(width, true, measuresPerLine)
    return
  }

  // 단성부: 기존처럼 단 수 줄이려고 폭만 조정
  let width = baseEngravingWidthPx()
  const targetSystems = 2
  const maxWidth = props.compact ? 720 : 1180
  for (let attempt = 0; attempt < 6; attempt++) {
    const systems = countSystems(instance)
    if (systems <= targetSystems || systems === 0) break
    if (width >= maxWidth) break
    width = Math.min(maxWidth, width * 1.12)
    paint(width, false, 0)
  }
}

async function renderScore() {
  const token = ++renderToken
  if (!host.value) return

  fitStyle.value = {}
  hostStyle.value = {}

  if (!hasSource.value) {
    status.value = 'idle'
    host.value.innerHTML = ''
    return
  }

  status.value = 'loading'
  errorMessage.value = ''
  host.value.innerHTML = ''

  try {
    const target = await resolveLoadTarget()
    if (token !== renderToken) return
    if (!target) {
      status.value = 'idle'
      return
    }

    const { OpenSheetMusicDisplay } = await import('opensheetmusicdisplay')
    if (token !== renderToken) return

    const layoutW = baseEngravingWidthPx()
    host.value.style.width = `${layoutW}px`

    osmd = new OpenSheetMusicDisplay(host.value, buildOptions())
    applyEngravingColors(osmd)
    await osmd.load(target)
    if (token !== renderToken) return

    await nextTick()
    renderEngravedLayout(osmd)
    if (token !== renderToken) return

    await nextTick()
    if (host.value) clearSvgBackground(host.value)
    if (osmd) applyLabelTypography(osmd)
    fitUniform()
    status.value = 'ready'
  } catch (err) {
    if (token !== renderToken) return
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : '악보를 불러오지 못했습니다.'
    console.error('[OsmdScore]', err)
  }
}

onMounted(() => {
  void renderScore()
  resizeObserver = new ResizeObserver(() => {
    if (status.value === 'ready') fitUniform()
  })
  if (wrap.value) resizeObserver.observe(wrap.value)
})

watch(
  () => [props.src, props.assetId, props.compact, props.scoreStyle] as const,
  () => {
    void renderScore()
  },
  { deep: true },
)

onBeforeUnmount(() => {
  renderToken += 1
  resizeObserver?.disconnect()
  resizeObserver = null
  osmd = null
  revokeBlob()
  if (host.value) host.value.innerHTML = ''
})
</script>

<template>
  <div
    ref="wrap"
    class="osmd-wrap"
    :class="[{ compact, 'theme-dark': colors.dark, 'theme-light': !colors.dark }]"
  >
    <div class="osmd-fit" :style="fitStyle">
      <div ref="host" class="osmd-host" :style="hostStyle" aria-label="악보" />
    </div>
    <p v-if="status === 'loading'" class="osmd-status">악보 불러오는 중…</p>
    <p v-else-if="status === 'error'" class="osmd-status error">{{ errorMessage }}</p>
    <p v-else-if="status === 'idle'" class="osmd-status">악보 파일을 올려 주세요</p>
  </div>
</template>

<style scoped>
.osmd-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 12rem;
  overflow: auto;
  display: grid;
  place-items: center;
  background: transparent;
}

.osmd-fit {
  position: relative;
  flex-shrink: 0;
  overflow: hidden;
  background: transparent;
}

.osmd-host {
  position: absolute;
  top: 0;
  left: 0;
  background: transparent;
}

.osmd-host :deep(svg) {
  display: block;
  background: transparent !important;
}

.osmd-status {
  position: absolute;
  inset: 0;
  margin: 0;
  display: grid;
  place-items: center;
  font-size: 0.9rem;
  opacity: 0.7;
  pointer-events: none;
}

.theme-dark .osmd-status {
  color: #f4efe4;
}

.theme-light .osmd-status {
  color: #1c2b26;
}

.osmd-status.error {
  color: #f0a8a0;
  opacity: 1;
  padding: 1rem;
  text-align: center;
}
</style>
