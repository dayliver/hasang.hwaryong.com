<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import SlideCanvas from '../components/SlideCanvas.vue'
import { preloadMassScores } from '../lib/scoreRender'
import { styleForSlide } from '../lib/scoreStyle'
import { useMassStore } from '../stores/mass'

const route = useRoute()
const router = useRouter()
const store = useMassStore()

const massId = computed(() => String(route.params.id ?? ''))
const mass = computed(() => (massId.value ? store.getById(massId.value) : undefined))

const index = ref(0)
/** Esc로 토글. 미사 중엔 숨기고, 필요할 때만 조작·편집 */
const showHud = ref(false)

const preparing = ref(true)
const prepareDone = ref(0)
const prepareTotal = ref(0)
const prepareLabel = ref('악보 준비 중…')

const slide = computed(() => mass.value?.slides[index.value])
const total = computed(() => mass.value?.slides.length ?? 0)
const slideScoreStyle = computed(() =>
  styleForSlide(slide.value?.scoreStyle, mass.value?.scoreStyle),
)

const scorePage = ref(1)
const scorePageCount = ref(1)
/** 이전 슬라이드로 돌아갈 때 악보 마지막 페이지로 */
let preferLastScorePage = false

const hasScoreXml = computed(() =>
  Boolean(
    slide.value?.mode === 'hymn-score' &&
      (slide.value.hymn?.musicXmlAssetId || slide.value.hymn?.musicXmlUrl),
  ),
)

async function prepareScores() {
  preparing.value = true
  prepareDone.value = 0
  prepareTotal.value = 0
  prepareLabel.value = '악보 엔진 불러오는 중…'
  const current = mass.value
  if (!current) {
    preparing.value = false
    return
  }
  try {
    await preloadMassScores(current, (done, totalCount, label) => {
      prepareDone.value = done
      prepareTotal.value = totalCount
      prepareLabel.value = label
    })
  } catch (err) {
    console.error('[PresenterView] preload', err)
    prepareLabel.value = '일부 악보 준비에 실패했습니다. 그래도 시작합니다.'
    await new Promise((r) => setTimeout(r, 600))
  } finally {
    preparing.value = false
  }
}

watch(massId, () => {
  index.value = 0
  scorePage.value = 1
  scorePageCount.value = 1
  preferLastScorePage = false
  void prepareScores()
})

watch(index, () => {
  scorePage.value = preferLastScorePage ? 9999 : 1
  scorePageCount.value = 1
})

function onScorePageCount(count: number) {
  const next = Math.max(1, count)
  if (scorePageCount.value !== next) scorePageCount.value = next
  if (preferLastScorePage) {
    scorePage.value = scorePageCount.value
    preferLastScorePage = false
  } else {
    const clamped = Math.min(Math.max(scorePage.value, 1), scorePageCount.value)
    if (scorePage.value !== clamped) scorePage.value = clamped
  }
}

function go(delta: number) {
  if (preparing.value || !mass.value) return

  if (hasScoreXml.value && scorePageCount.value > 1) {
    if (delta > 0 && scorePage.value < scorePageCount.value) {
      scorePage.value += 1
      return
    }
    if (delta < 0 && scorePage.value > 1) {
      scorePage.value -= 1
      return
    }
  }

  const next = index.value + delta
  if (next < 0 || next >= total.value) return
  preferLastScorePage = delta < 0
  index.value = next
}

function goEdit() {
  if (!mass.value) return
  void router.push(`/edit/${mass.value.id}`)
}

function goManage() {
  void router.push('/manage')
}

function onKey(e: KeyboardEvent) {
  if (preparing.value) return
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault()
    go(1)
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault()
    go(-1)
  } else if (e.key === 'Home') {
    preferLastScorePage = false
    index.value = 0
    scorePage.value = 1
  } else if (e.key === 'End' && total.value) {
    preferLastScorePage = true
    index.value = total.value - 1
  } else if (e.key === 'Escape') {
    showHud.value = !showHud.value
  } else if ((e.key === 'e' || e.key === 'E') && showHud.value) {
    e.preventDefault()
    goEdit()
  } else if ((e.key === 'm' || e.key === 'M') && showHud.value) {
    e.preventDefault()
    goManage()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
  void prepareScores()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
})

const progressLabel = computed(() => {
  const base = `${index.value + 1} / ${total.value}`
  if (hasScoreXml.value && scorePageCount.value > 1) {
    return `${base} · 악보 ${scorePage.value}/${scorePageCount.value}`
  }
  return base
})

const preparePercent = computed(() => {
  if (prepareTotal.value <= 0) return preparing.value ? 12 : 100
  return Math.round((prepareDone.value / prepareTotal.value) * 100)
})
</script>

<template>
  <div class="presenter" @click="go(1)">
    <div v-if="preparing" class="prepare-overlay" @click.stop>
      <span class="spinner" aria-hidden="true" />
      <p class="prepare-title">슬라이드쇼 준비</p>
      <p class="prepare-label">{{ prepareLabel }}</p>
      <div v-if="prepareTotal > 0" class="prepare-bar" aria-hidden="true">
        <span :style="{ width: `${preparePercent}%` }" />
      </div>
      <p v-if="prepareTotal > 0" class="prepare-count">
        {{ prepareDone }} / {{ prepareTotal }}
      </p>
    </div>

    <template v-else-if="mass && slide">
      <SlideCanvas
        :slide="slide"
        :score-theme="mass.scoreTheme ?? 'dark'"
        :score-style="slideScoreStyle"
        :score-page="scorePage"
        presenting
        class="full"
        @update:score-page="scorePage = $event"
        @score-page-count="onScorePageCount"
      />

      <div v-show="showHud" class="hud" @click.stop>
        <button type="button" class="hud-edit" @click="goEdit">
          편집
          <kbd>E</kbd>
        </button>
        <button type="button" class="hud-edit" @click="goManage">
          관리
          <kbd>M</kbd>
        </button>
        <p class="progress">{{ progressLabel }} · {{ mass.title }}</p>
        <div class="nav">
          <button type="button" class="btn ghost" @click="go(-1)">이전</button>
          <button type="button" class="btn primary" @click="go(1)">다음</button>
        </div>
      </div>
      <p v-show="showHud" class="hint">← → / Space · 악보는 페이지 먼저 · Esc로 조작 UI 닫기</p>
    </template>

    <div v-else class="missing">
      <p>미사를 찾을 수 없습니다.</p>
      <RouterLink class="btn primary" to="/">목록으로</RouterLink>
    </div>
  </div>
</template>

<style scoped>
.presenter {
  min-height: 100vh;
  min-height: 100dvh;
  background: #000;
  display: grid;
  place-items: center;
  position: relative;
  cursor: pointer;
}

.full {
  width: min(100vw, calc(100dvh * 16 / 9));
  max-height: 100dvh;
  border-radius: 0 !important;
  box-shadow: none !important;
}

.prepare-overlay {
  position: fixed;
  inset: 0;
  z-index: 5;
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 0.65rem;
  background: #050706;
  color: #f4efe4;
  cursor: default;
}

.prepare-title {
  margin: 0.35rem 0 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  font-weight: 700;
}

.prepare-label {
  margin: 0;
  font-size: 0.9rem;
  color: rgba(244, 239, 228, 0.65);
  text-align: center;
  max-width: 22rem;
  line-height: 1.4;
}

.prepare-bar {
  width: min(16rem, 70vw);
  height: 0.35rem;
  margin-top: 0.35rem;
  border-radius: 999px;
  background: rgba(244, 239, 228, 0.12);
  overflow: hidden;
}

.prepare-bar > span {
  display: block;
  height: 100%;
  background: #e8c57a;
  border-radius: inherit;
  transition: width 0.2s ease;
}

.prepare-count {
  margin: 0;
  font-size: 0.78rem;
  font-variant-numeric: tabular-nums;
  color: rgba(244, 239, 228, 0.45);
}

.spinner {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  border: 2px solid rgba(244, 239, 228, 0.18);
  border-top-color: #e8c57a;
  animation: spin 0.7s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.hud {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  background: linear-gradient(transparent, rgba(0, 0, 0, 0.72));
  color: #f4efe4;
  cursor: default;
  z-index: 2;
}

.hud-edit {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  border: 1px solid rgba(244, 239, 228, 0.35);
  background: rgba(244, 239, 228, 0.12);
  color: #f4efe4;
  border-radius: 0.4rem;
  padding: 0.4rem 0.65rem;
  font: inherit;
  font-size: 0.85rem;
  font-weight: 600;
  cursor: pointer;
}

.hud-edit:hover {
  background: rgba(244, 239, 228, 0.22);
}

.hud-edit kbd {
  font: inherit;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  padding: 0.12rem 0.35rem;
  border-radius: 0.25rem;
  border: 1px solid rgba(244, 239, 228, 0.4);
  background: rgba(0, 0, 0, 0.35);
  color: rgba(244, 239, 228, 0.9);
}

.progress {
  margin: 0;
  flex: 1;
  font-size: 0.85rem;
  opacity: 0.8;
}

.nav {
  display: flex;
  gap: 0.4rem;
}

.hint {
  position: fixed;
  top: 0.75rem;
  right: 1rem;
  margin: 0;
  font-size: 0.72rem;
  color: rgba(244, 239, 228, 0.45);
  pointer-events: none;
  z-index: 2;
}

.missing {
  color: #f4efe4;
  display: grid;
  gap: 1rem;
  justify-items: center;
}
</style>
