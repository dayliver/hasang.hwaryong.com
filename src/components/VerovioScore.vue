<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ScoreStyle } from '../types/mass'
import { getAsset } from '../lib/assetStore'
import { getScoreFont } from '../lib/scoreFonts'
import { colorsForStyle, clampLyricsScale } from '../lib/scoreStyle'
import { getVerovioToolkit, isZipBuffer, meiHideLowerStaves } from '../lib/verovioToolkit'

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

let renderToken = 0
let resizeObserver: ResizeObserver | null = null

function buildVerovioOptions() {
  const lyricsScale = clampLyricsScale(props.scoreStyle?.lyricsScale)
  return {
    inputFrom: 'xml',
    scale: props.compact ? 36 : 42,
    pageWidth: props.compact ? 1400 : 2000,
    adjustPageHeight: true,
    adjustPageWidth: true,
    breaks: 'auto' as const,
    footer: 'none' as const,
    header: 'none' as const,
    svgViewBox: true,
    // 시가에 비례하는 가로 간격 (근본 목적)
    spacingNonLinear: 1.0,
    spacingLinear: props.compact ? 0.04 : 0.05,
    lyricSize: (props.compact ? 5.2 : 6.2) * lyricsScale,
    lyricTopMinMargin: 2.0,
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
    .mNum, .mNum text { display: none !important; }
  `
  const svg = root.querySelector('svg')
  if (svg) svg.prepend(style)
  else root.prepend(style)

  // 오선 hairline
  root.querySelectorAll('.staff line, .staff path').forEach((el) => {
    const s = el as SVGElement
    s.setAttribute('vector-effect', 'non-scaling-stroke')
    s.style.vectorEffect = 'non-scaling-stroke'
    s.style.strokeWidth = '0.7px'
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

  const pad = props.compact ? 0.9 : 0.93
  const availW = Math.max(wrapEl.clientWidth, 1) * pad
  const availH = Math.max(wrapEl.clientHeight, 1) * pad
  const maxScale = props.compact ? 1.45 : 3.4
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
    const toolkit = await getVerovioToolkit()
    if (token !== renderToken) return

    const payload = await resolveScorePayload()
    if (token !== renderToken) return

    toolkit.setOptions(buildVerovioOptions())

    let loaded = false
    if (payload.kind === 'zip') {
      loaded = Boolean(toolkit.loadZipDataBuffer(payload.buffer))
    } else {
      loaded = Boolean(toolkit.loadData(payload.text))
    }
    if (!loaded) throw new Error('악보 데이터를 해석하지 못했습니다.')

    if (props.scoreStyle?.staffFilter === 'treble') {
      const mei = toolkit.getMEI()
      const filtered = meiHideLowerStaves(mei)
      if (filtered !== mei) {
        toolkit.setOptions(buildVerovioOptions())
        if (!toolkit.loadData(filtered)) {
          throw new Error('트레블 필터를 적용하지 못했습니다.')
        }
      }
    }

    const pageCount = Math.max(1, toolkit.getPageCount())
    const chunks: string[] = []
    for (let page = 1; page <= pageCount; page++) {
      chunks.push(toolkit.renderToSVG(page))
    }
    host.value.innerHTML = chunks.join('')
    applyThemeToSvgRoot(host.value)

    await nextTick()
    if (token !== renderToken) return
    fitUniform()
    status.value = 'ready'
  } catch (err) {
    if (token !== renderToken) return
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
