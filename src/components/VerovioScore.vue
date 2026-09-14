<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { ScoreStyle } from '../types/mass'
import {
  ensureScoreCached,
  getScorePageCache,
  makeScoreCacheKey,
  scoreStyleKey,
  type ScorePageCache,
} from '../lib/scoreRender'
import { ensureScoreFontsLoaded } from '../lib/scoreFonts'
import { colorsForStyle } from '../lib/scoreStyle'

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
const revealed = ref(false)

const hasSource = computed(() => Boolean(props.assetId || props.src))
const colors = computed(() => colorsForStyle(props.scoreStyle))

let renderToken = 0
let resizeObserver: ResizeObserver | null = null
let activeCache: ScorePageCache | null = null

function cacheKey(): string {
  return makeScoreCacheKey({
    assetId: props.assetId,
    src: props.src,
    scoreStyle: props.scoreStyle,
    compact: props.compact,
  })
}

function setPageCount(count: number) {
  const next = Math.max(1, count)
  if (pageCount.value === next) return
  pageCount.value = next
  emit('pageCount', next)
}

function clampPage(page: number, count: number): number {
  return Math.min(Math.max(Math.round(page) || 1, 1), Math.max(count, 1))
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

async function paintPage(page: number) {
  if (!host.value || !activeCache) return
  const count = activeCache.pageCount
  setPageCount(count)

  const target = clampPage(page, count)
  if (target !== props.page) {
    emit('update:page', target)
    return
  }

  revealed.value = false
  host.value.innerHTML = activeCache.pages[target - 1] ?? ''
  await ensureScoreFontsLoaded([props.scoreStyle])
  await nextTick()
  fitUniform()
  // 레이아웃·폰트 적용 후 페이드 인
  requestAnimationFrame(() => {
    revealed.value = true
  })
}

async function renderScore() {
  const token = ++renderToken
  activeCache = null
  revealed.value = false
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

  try {
    await ensureScoreFontsLoaded([props.scoreStyle])
    if (token !== renderToken) return

    const key = cacheKey()
    let cached = getScorePageCache(key)
    if (!cached) {
      cached = await ensureScoreCached({
        assetId: props.assetId,
        src: props.src,
        scoreStyle: props.scoreStyle,
        compact: props.compact,
      })
    }
    if (token !== renderToken) return

    activeCache = cached
    status.value = 'ready'
    await paintPage(props.page)
    if (token !== renderToken) return
  } catch (err) {
    if (token !== renderToken) return
    activeCache = null
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
  () =>
    [props.src ?? '', props.assetId ?? '', props.compact, scoreStyleKey(props.scoreStyle)] as const,
  (next, prev) => {
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
    if (status.value !== 'ready' || !activeCache) return
    void paintPage(page)
  },
)

onBeforeUnmount(() => {
  renderToken += 1
  activeCache = null
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
      <div
        ref="host"
        class="vrv-host"
        :class="{ revealed }"
        :style="hostStyle"
        aria-label="악보"
      />
    </div>
    <div v-if="status === 'loading'" class="vrv-loading" role="status">
      <span class="spinner" aria-hidden="true" />
      <p>악보 불러오는 중…</p>
    </div>
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
  opacity: 0;
  transition: opacity 0.28s ease;
}

.vrv-host.revealed {
  opacity: 1;
}

.vrv-host :deep(svg) {
  display: block;
  max-width: none;
}

.vrv-loading {
  position: absolute;
  inset: 0;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.75rem;
  background: color-mix(in srgb, #050706 55%, transparent);
  z-index: 2;
}

.vrv-loading p {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(244, 239, 228, 0.75);
}

.spinner {
  width: 2rem;
  height: 2rem;
  border-radius: 50%;
  border: 2px solid rgba(244, 239, 228, 0.2);
  border-top-color: rgba(232, 197, 122, 0.95);
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
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

.theme-light .vrv-loading {
  background: color-mix(in srgb, #f4efe4 70%, transparent);
}

.theme-light .vrv-loading p {
  color: rgba(28, 43, 38, 0.75);
}

.theme-light .spinner {
  border-color: rgba(28, 43, 38, 0.15);
  border-top-color: rgba(107, 84, 32, 0.9);
}
</style>
