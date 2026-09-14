<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ScoreStyle } from '../types/mass'
import { getAsset } from '../lib/assetStore'
import { getScoreFont } from '../lib/scoreFonts'
import {
  colorsForStyle,
  clampLyricsScale,
  clampSpacingLinear,
  clampSpacingNonLinear,
  clampSystemsPerPage,
} from '../lib/scoreStyle'
import { getVerovioToolkit, isZipBuffer, meiHideLowerStaves } from '../lib/verovioToolkit'

const props = withDefaults(
  defineProps<{
    src?: string
    assetId?: string
    scoreStyle?: ScoreStyle | null
    compact?: boolean
    /** 1-based Verovio page */
    page?: number
  }>(),
  {
    compact: false,
    page: 1,
  },
)

const emit = defineEmits<{
  'update:page': [page: number]
  pageCount: [count: number]
}>()

const wrap = ref<HTMLElement | null>(null)
const host = ref<HTMLElement | null>(null)
const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle')
const errorMessage = ref('')
const fitStyle = ref<Record<string, string>>({})
const hostStyle = ref<Record<string, string>>({})
const pageCount = ref(1)

const hasSource = computed(() => Boolean(props.assetId || props.src))
const colors = computed(() => colorsForStyle(props.scoreStyle))
const scoreFont = computed(() => getScoreFont(props.scoreStyle?.fontId))
const systemsPerPage = computed(() => clampSystemsPerPage(props.scoreStyle?.systemsPerPage))

let renderToken = 0
let resizeObserver: ResizeObserver | null = null
/** 로드된 악보가 아직 toolkit에 있을 때만 페이지 전환 가능 */
let scoreLoaded = false

function hasForcedSystemBreaks(source: string): boolean {
  return /new-system\s*=\s*["']yes["']/i.test(source) || /<sb[\s/>]/i.test(source)
}

/**
 * Verovio lyricSize는 2~8만 허용.
 * UI 배율 0.8~1.8을 그 구간에 선형 매핑 (넘치면 옵션이 무시되어 크기 변화가 없어 보였음).
 */
function verovioLyricSize(scale: number): number {
  const s = clampLyricsScale(scale)
  const t = (s - 0.8) / (1.8 - 0.8)
  return Math.round((2 + t * 6) * 100) / 100
}

function buildVerovioOptions(
  breaks: 'none' | 'line' = 'none',
  inputFrom: 'xml' | 'mei' = 'xml',
  paginate = false,
) {
  const lyricsScale = clampLyricsScale(props.scoreStyle?.lyricsScale)
  const spacingNonLinear = clampSpacingNonLinear(props.scoreStyle?.spacingNonLinear)
  const spacingLinear = clampSpacingLinear(props.scoreStyle?.spacingLinear)
  return {
    inputFrom,
    scale: props.compact ? 36 : 42,
    pageWidth: props.compact ? 1400 : 2000,
    adjustPageHeight: true,
    // true면 내용에 맞춰 페이지 폭이 줄어 윗줄·아랫줄 너비가 어긋나기 쉬움
    adjustPageWidth: false,
    breaks,
    footer: 'none' as const,
    header: 'auto' as const,
    usePgHeaderForAll: false,
    svgViewBox: true,
    spacingNonLinear,
    spacingLinear,
    // line + systemMaxPerPage 로 N줄씩 페이지 분할 (encoded는 한 페이지에 몰아넣음)
    systemMaxPerPage: paginate ? systemsPerPage.value : 0,
    lyricSize: verovioLyricSize(lyricsScale),
    lyricTopMinMargin: 1.2,
    bottomMarginHeader: props.compact ? 1.5 : 2.0,
    pageMarginTop: props.compact ? 56 : 72,
    pageMarginBottom: 8,
    pageMarginLeft: 8,
    pageMarginRight: 8,
    noJustification: false,
    minLastJustification: 0,
    mnumInterval: 0,
    svgHtml5: true,
  }
}

async function resolveScorePayload(): Promise<
  { kind: 'xml'; text: string } | { kind: 'zip'; buffer: ArrayBuffer }
> {
  if (props.assetId) {
    const asset = await getAsset(props.assetId)
    if (!asset) throw new Error('올린 악보 파일을 찾을 수 없습니다. 다시 올려 주세요.')
    const buffer = await asset.blob.arrayBuffer()
    if (isZipBuffer(buffer) || /\.mxl$/i.test(asset.name)) {
      return { kind: 'zip', buffer }
    }
    return { kind: 'xml', text: new TextDecoder('utf-8').decode(buffer) }
  }
  if (props.src) {
    const res = await fetch(props.src)
    if (!res.ok) throw new Error('악보 URL을 불러오지 못했습니다.')
    const buffer = await res.arrayBuffer()
    if (isZipBuffer(buffer) || /\.mxl$/i.test(props.src)) {
      return { kind: 'zip', buffer }
    }
    return { kind: 'xml', text: new TextDecoder('utf-8').decode(buffer) }
  }
  throw new Error('악보 소스가 없습니다.')
}

function applyThemeToSvgRoot(root: HTMLElement) {
  const c = colors.value
  const font = scoreFont.value
  const styleId = 'vrv-theme'
  root.querySelector(`#${styleId}`)?.remove()

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
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
  if (svg) svg.prepend(style)
  else root.prepend(style)

  const titleScale = 1.4
  root.querySelectorAll('.pgHead [font-size]').forEach((el) => {
    const raw = el.getAttribute('font-size')
    if (!raw) return
    const n = Number.parseFloat(raw)
    if (!Number.isFinite(n) || n <= 0) return
    const unit = raw.replace(/[\d.+-eE]/g, '') || 'px'
    el.setAttribute('font-size', `${n * titleScale}${unit}`)
  })
}

function readSvgSize(svg: SVGSVGElement): { w: number; h: number } {
  const vb = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (vb && vb.length === 4 && vb[2]! > 0 && vb[3]! > 0) {
    return { w: vb[2]!, h: vb[3]! }
  }
  const attrW = Number(svg.getAttribute('width'))
  const attrH = Number(svg.getAttribute('height'))
  if (attrW > 0 && attrH > 0) return { w: attrW, h: attrH }
  try {
    const box = svg.getBBox()
    if (box.width > 0 && box.height > 0) return { w: box.width, h: box.height }
  } catch {
    /* empty */
  }
  return { w: 800, h: 240 }
}

function fitUniform() {
  const wrapEl = wrap.value
  const hostEl = host.value
  if (!wrapEl || !hostEl) return

  const svgs = [...hostEl.querySelectorAll('svg')] as SVGSVGElement[]
  if (!svgs.length) return

  let totalW = 0
  let totalH = 0
  for (const svg of svgs) {
    const { w, h } = readSvgSize(svg)
    totalW = Math.max(totalW, w)
    totalH += h
  }

  const pad = props.compact ? 0.98 : 0.995
  const availW = Math.max(wrapEl.clientWidth, 1) * pad
  const availH = Math.max(wrapEl.clientHeight, 1) * pad
  const maxScale = props.compact ? 1.6 : 4
  const scale = Math.min(availW / totalW, availH / totalH, maxScale)

  fitStyle.value = {
    width: `${Math.ceil(totalW * scale)}px`,
    height: `${Math.ceil(totalH * scale)}px`,
  }
  hostStyle.value = {
    width: `${totalW}px`,
    height: `${totalH}px`,
    transform: `scale(${scale})`,
    transformOrigin: 'top left',
  }
}

function clampPage(page: number, count: number): number {
  return Math.min(Math.max(Math.round(page) || 1, 1), Math.max(count, 1))
}

/** 객체 참조가 바뀌어도 내용이 같으면 재로드하지 않기 위함 */
function styleRenderKey(style?: ScoreStyle | null): string {
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

function setPageCount(count: number) {
  const next = Math.max(1, count)
  if (pageCount.value === next) return
  pageCount.value = next
  emit('pageCount', next)
}

async function paintPage(page: number) {
  if (!host.value || !scoreLoaded) return
  const toolkit = await getVerovioToolkit()
  const count = Math.max(1, toolkit.getPageCount())
  setPageCount(count)

  const target = clampPage(page, count)
  if (target !== props.page) {
    emit('update:page', target)
    // 부모가 page를 고치면 watch가 다시 paintPage 호출
    return
  }

  host.value.innerHTML = toolkit.renderToSVG(target)
  applyThemeToSvgRoot(host.value)
  await nextTick()
  fitUniform()
}

async function renderScore() {
  const token = ++renderToken
  scoreLoaded = false
  if (!host.value) return

  fitStyle.value = {}
  hostStyle.value = {}

  if (!hasSource.value) {
    status.value = 'idle'
    host.value.innerHTML = ''
    setPageCount(1)
    return
  }

  status.value = 'loading'
  errorMessage.value = ''
  // 이전 SVG는 새 판각이 끝날 때까지 유지 (깜빡임·재진입 루프 완화)

  try {
    const toolkit = await getVerovioToolkit()
    if (token !== renderToken) return

    const payload = await resolveScorePayload()
    if (token !== renderToken) return

    // 1차: 자동 줄바꿈 없이 로드 → MEI에 강제 sb가 있는지 확인
    toolkit.setOptions(buildVerovioOptions('none'))

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
    if (props.scoreStyle?.staffFilter === 'treble') {
      workingMei = meiHideLowerStaves(workingMei)
    }

    // 강제 줄바꿈이 있으면 line + systemMaxPerPage 로 N줄씩 페이지화
    // (encoded는 모든 시스템을 한 페이지에 쌓아서 투영에 부적합)
    // MEI 재로드 시 inputFrom: mei 필수
    toolkit.setOptions(
      buildVerovioOptions(useLineBreaks ? 'line' : 'none', 'mei', useLineBreaks),
    )
    if (!toolkit.loadData(workingMei)) {
      throw new Error(useLineBreaks ? '줄바꿈 적용에 실패했습니다.' : '악보 재로드에 실패했습니다.')
    }

    if (token !== renderToken) return
    scoreLoaded = true
    status.value = 'ready'
    await paintPage(props.page)
    if (token !== renderToken) return
  } catch (err) {
    if (token !== renderToken) return
    scoreLoaded = false
    status.value = 'error'
    errorMessage.value = err instanceof Error ? err.message : '악보를 불러오지 못했습니다.'
    console.error('[VerovioScore]', err)
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
  () => [props.src ?? '', props.assetId ?? '', props.compact, styleRenderKey(props.scoreStyle)] as const,
  (next, prev) => {
    // 마운트 직후 중복 호출 방지 (onMounted에서 이미 render)
    if (!prev) return
    if (next[0] === prev[0] && next[1] === prev[1] && next[2] === prev[2] && next[3] === prev[3]) {
      return
    }
    void renderScore()
  },
)

watch(
  () => props.page,
  (page) => {
    if (status.value !== 'ready' || !scoreLoaded) return
    void paintPage(page)
  },
)

onBeforeUnmount(() => {
  renderToken += 1
  scoreLoaded = false
  resizeObserver?.disconnect()
  resizeObserver = null
  if (host.value) host.value.innerHTML = ''
})
</script>

<template>
  <div
    ref="wrap"
    class="vrv-wrap"
    :class="[{ compact, 'theme-dark': colors.dark, 'theme-light': !colors.dark }]"
  >
    <div class="vrv-fit" :style="fitStyle">
      <div ref="host" class="vrv-host" :style="hostStyle" aria-label="악보" />
    </div>
    <p v-if="status === 'loading'" class="vrv-status">악보 불러오는 중…</p>
    <p v-else-if="status === 'error'" class="vrv-status error">{{ errorMessage }}</p>
    <p v-else-if="status === 'idle'" class="vrv-status">악보 파일을 올려 주세요</p>
  </div>
</template>

<style scoped>
.vrv-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 12rem;
  overflow: auto;
  display: grid;
  place-items: center;
  background: transparent;
}

.vrv-fit {
  position: relative;
  overflow: hidden;
}

.vrv-host {
  position: absolute;
  top: 0;
  left: 0;
}

.vrv-host :deep(svg) {
  display: block;
  max-width: none;
}

.vrv-status {
  position: absolute;
  inset: auto 0 1rem;
  margin: 0;
  text-align: center;
  font-size: 0.9rem;
  color: color-mix(in srgb, var(--muted, #888) 90%, transparent);
  pointer-events: none;
}

.vrv-status.error {
  color: #e8a0a0;
}

.theme-dark .vrv-status {
  color: rgba(244, 239, 228, 0.55);
}
</style>
