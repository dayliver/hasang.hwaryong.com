<script setup lang="ts">
import { computed } from 'vue'
import type { ScoreStyle, ScoreTheme, Slide } from '../types/mass'
import { SLIDE_MODE_LABEL } from '../types/mass'
import { useAssetObjectUrl } from '../composables/useAssetObjectUrl'
import { colorsForStyle } from '../lib/scoreStyle'
import OsmdScore from './OsmdScore.vue'
import SlideImage from './SlideImage.vue'

const props = withDefaults(
  defineProps<{
    slide: Slide
    compact?: boolean
    scoreTheme?: ScoreTheme
    scoreStyle?: ScoreStyle | null
    presenting?: boolean
  }>(),
  {
    compact: false,
    scoreTheme: 'dark',
    presenting: false,
  },
)

const imageAsset = useAssetObjectUrl(computed(() => props.slide.imageAssetId))
const scoreImageAsset = useAssetObjectUrl(computed(() => props.slide.hymn?.scoreAssetId))

const imageSrc = computed(() => imageAsset.url.value || props.slide.imageUrl || null)
const scoreImageSrc = computed(
  () => scoreImageAsset.url.value || props.slide.hymn?.scoreUrl || null,
)

const hasOsmd = computed(
  () => Boolean(props.slide.hymn?.musicXmlAssetId || props.slide.hymn?.musicXmlUrl),
)

const effectiveTheme = computed(() => {
  if (props.scoreStyle?.palette) {
    return colorsForStyle(props.scoreStyle).dark ? 'dark' : 'light'
  }
  return props.scoreTheme
})
</script>

<template>
  <article
    class="slide-canvas"
    :class="[
      `mode-${slide.mode}`,
      `theme-${effectiveTheme}`,
      { compact, presenting },
    ]"
  >
    <p
      v-if="slide.mode !== 'black' && slide.mode !== 'image' && slide.mode !== 'title'"
      class="slide-label"
    >
      {{ slide.label }}
    </p>

    <template v-if="slide.mode === 'black'">
      <span class="sr-only">{{ slide.label || '블랙' }}</span>
    </template>

    <template v-else-if="slide.mode === 'image'">
      <SlideImage
        class="full-bleed"
        :src="imageSrc"
        :alt="slide.label"
        :loading="imageAsset.loading.value"
        label="이미지"
      />
    </template>

    <template v-else-if="slide.mode === 'title'">
      <h1 class="slide-title">{{ slide.label }}</h1>
      <p v-if="slide.body" class="slide-body title-body">{{ slide.body }}</p>
    </template>

    <template v-else-if="slide.mode === 'prayer'">
      <h2 class="slide-heading">{{ slide.label }}</h2>
      <p class="slide-body prayer-body">{{ slide.body }}</p>
    </template>

    <template v-else-if="slide.mode === 'hymn-number'">
      <h2 class="slide-heading">{{ slide.label }}</h2>
      <p class="hymn-number">{{ slide.hymn?.number }}</p>
      <p class="hymn-title">{{ slide.hymn?.title }}</p>
    </template>

    <template v-else-if="slide.mode === 'hymn-score'">
      <div class="score-header" :class="{ slim: presenting }">
        <h2 class="slide-heading">{{ slide.label }}</h2>
        <p class="score-meta">
          <span v-if="slide.hymn?.number" class="score-num">{{ slide.hymn.number }}</span>
          {{ slide.hymn?.title }}
        </p>
      </div>
      <div class="score-frame">
        <OsmdScore
          v-if="hasOsmd"
          :asset-id="slide.hymn?.musicXmlAssetId"
          :src="slide.hymn?.musicXmlUrl"
          :score-style="scoreStyle"
          :compact="compact"
        />
        <SlideImage
          v-else-if="scoreImageSrc || scoreImageAsset.loading.value"
          class="score-bleed"
          :src="scoreImageSrc"
          :alt="`${slide.hymn?.number ?? ''} ${slide.hymn?.title ?? ''} 악보`"
          :loading="scoreImageAsset.loading.value"
          :inverted="effectiveTheme === 'dark'"
          label="악보 이미지"
        />
        <p v-else class="score-placeholder">
          악보 없음
          <span>아래에서 MusicXML 또는 이미지를 올려 주세요</span>
        </p>
      </div>
    </template>

    <template v-else>
      <h2 class="slide-heading">{{ slide.label }}</h2>
      <p class="slide-body">{{ slide.body }}</p>
    </template>

    <span v-if="!presenting" class="mode-chip">{{ SLIDE_MODE_LABEL[slide.mode] }}</span>
  </article>
</template>

<style scoped>
.slide-canvas {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  padding: clamp(1.25rem, 4vw, 2.75rem);
  border-radius: 0.75rem;
  overflow: hidden;
  background: #050706;
  color: #f4efe4;
  box-shadow: 0 18px 40px color-mix(in srgb, var(--ink) 18%, transparent);
}

.theme-dark.mode-title,
.theme-dark.mode-prayer,
.theme-dark.mode-hymn-number,
.theme-dark.mode-order,
.theme-dark.mode-hymn-score {
  background:
    radial-gradient(ellipse 70% 55% at 50% 0%, rgba(201, 162, 74, 0.12), transparent 65%),
    linear-gradient(165deg, #0e1613 0%, #050706 55%, #0a100e 100%);
}

.theme-light {
  background: #f4efe4;
  color: #1c2b26;
}

.slide-canvas.compact {
  aspect-ratio: 16 / 10;
  border-radius: 0.5rem;
  box-shadow: none;
}

.mode-black {
  background: #000 !important;
  padding: 0;
}

.mode-image {
  padding: 0;
  background: #000;
}

.full-bleed {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  min-height: 100%;
}

.score-bleed {
  width: 100%;
  height: 100%;
  min-height: 12rem;
}

.slide-label {
  position: absolute;
  top: 1rem;
  left: 1.25rem;
  margin: 0;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  opacity: 0.55;
  z-index: 1;
}

.slide-title {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(1.8rem, 5vw, 3.4rem);
  font-weight: 700;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.title-body {
  margin-top: 1rem;
  white-space: pre-line;
  font-size: clamp(1rem, 2.4vw, 1.45rem);
  opacity: 0.85;
  line-height: 1.55;
}

.slide-heading {
  margin: 0 0 1rem;
  font-family: var(--font-display);
  font-size: clamp(1.1rem, 2.5vw, 1.6rem);
  font-weight: 600;
  letter-spacing: -0.02em;
  color: color-mix(in srgb, var(--accent) 70%, white);
}

.theme-light .slide-heading {
  color: var(--accent-ink);
}

.slide-body {
  margin: 0;
  white-space: pre-line;
  font-size: clamp(1.05rem, 2.8vw, 1.7rem);
  line-height: 1.65;
  max-width: 28ch;
}

.prayer-body {
  font-family: var(--font-display);
  font-size: clamp(1.15rem, 3.2vw, 2rem);
  line-height: 1.7;
}

.hymn-number {
  margin: 0;
  font-family: var(--font-display);
  font-size: clamp(4rem, 14vw, 8.5rem);
  font-weight: 700;
  line-height: 1;
  letter-spacing: -0.04em;
  color: var(--accent);
}

.hymn-title {
  margin: 0.75rem 0 0;
  font-size: clamp(1.1rem, 2.8vw, 1.75rem);
  opacity: 0.9;
}

.score-header {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 1rem;
  margin-bottom: 0.5rem;
  flex-shrink: 0;
}

.score-header.slim {
  margin-bottom: 0.35rem;
}

.score-header.slim .slide-heading {
  font-size: clamp(0.95rem, 2vw, 1.25rem);
}

.score-header.slim .score-meta {
  font-size: 0.85rem;
}

.score-header .slide-heading {
  margin: 0;
}

.score-meta {
  margin: 0;
  font-size: 0.95rem;
  opacity: 0.85;
}

.score-num {
  display: inline-block;
  margin-right: 0.35rem;
  padding: 0.1rem 0.45rem;
  border-radius: 0.3rem;
  background: color-mix(in srgb, var(--accent) 25%, transparent);
  color: var(--accent);
  font-weight: 700;
}

.score-frame {
  flex: 1;
  width: 100%;
  min-height: 0;
  display: flex;
  align-items: stretch;
  justify-content: center;
  border-radius: 0.5rem;
  overflow: hidden;
}

.score-placeholder {
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  opacity: 0.55;
  font-size: 1rem;
  border: 1px dashed color-mix(in srgb, #f4efe4 28%, transparent);
  border-radius: 0.5rem;
  padding: 2rem;
  width: 100%;
  align-items: center;
}

.score-placeholder span {
  font-size: 0.8rem;
}

.score-frame img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.mode-chip {
  position: absolute;
  right: 1rem;
  bottom: 0.85rem;
  font-size: 0.68rem;
  letter-spacing: 0.06em;
  padding: 0.2rem 0.5rem;
  border-radius: 0.3rem;
  background: color-mix(in srgb, #000 35%, transparent);
  opacity: 0.7;
  z-index: 1;
}

.mode-hymn-score {
  justify-content: flex-start;
  align-items: stretch;
  text-align: left;
}

.mode-hymn-score.presenting {
  padding: clamp(0.75rem, 2.5vw, 1.5rem);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  border: 0;
}

@media (max-width: 640px) {
  .score-header {
    flex-direction: column;
    align-items: flex-start;
  }
}
</style>
