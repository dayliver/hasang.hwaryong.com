<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import FileDropField from '../components/FileDropField.vue'
import SlideCanvas from '../components/SlideCanvas.vue'
import { useMassStore } from '../stores/mass'
import { SLIDE_MODE_LABEL, type HymnRef, type MassKind, type ScoreFontId, type ScorePaletteId, type ScoreStaffFilter, type ScoreStyle, type SlideMode } from '../types/mass'
import {
  SCORE_PALETTES,
  cloneResolvedScoreStyle,
  getPalette,
  styleForSlide,
} from '../lib/scoreStyle'
import { SCORE_FONTS } from '../lib/scoreFonts'

const route = useRoute()
const store = useMassStore()

const massId = computed(() => String(route.params.id))
const mass = computed(() => store.getById(massId.value))

const selectedId = ref<string | null>(null)

watch(
  mass,
  (m) => {
    if (!m) return
    if (!selectedId.value || !m.slides.some((s) => s.id === selectedId.value)) {
      selectedId.value = m.slides[0]?.id ?? null
    }
  },
  { immediate: true },
)

const selected = computed(() => mass.value?.slides.find((s) => s.id === selectedId.value))
const selectedIndex = computed(() =>
  mass.value ? mass.value.slides.findIndex((s) => s.id === selectedId.value) : -1,
)

const modes = Object.entries(SLIDE_MODE_LABEL) as [SlideMode, string][]

const MASS_KINDS: MassKind[] = [
  '주일미사',
  '평일미사',
  '특전미사',
  '혼인미사',
  '장례미사',
  '떼제미사',
  '기타',
]

function patchMassMeta(partial: {
  title?: string
  kind?: MassKind
  scheduledAt?: string
  locationNote?: string
}) {
  store.updateMass(massId.value, partial)
}

/** datetime-local 입력용 (로컬 시각, 초 생략) */
function toDatetimeLocalValue(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 16)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function fromDatetimeLocalValue(value: string): string {
  if (!value) return new Date().toISOString().slice(0, 19)
  return value.length === 16 ? `${value}:00` : value.slice(0, 19)
}

function select(id: string) {
  selectedId.value = id
}

function move(delta: number) {
  if (selectedIndex.value < 0) return
  store.moveSlide(massId.value, selectedIndex.value, selectedIndex.value + delta)
}

function addSlide(mode: SlideMode) {
  const after = selectedIndex.value >= 0 ? selectedIndex.value : undefined
  const created = store.addSlide(massId.value, mode, after)
  if (created) selectedId.value = created.id
}

function duplicateSelected() {
  if (!selected.value) return
  const created = store.duplicateSlide(massId.value, selected.value.id)
  if (created) selectedId.value = created.id
}

function removeSelected() {
  if (!selected.value || !mass.value) return
  if (mass.value.slides.length <= 1) return
  const idx = selectedIndex.value
  const ok = store.removeSlide(massId.value, selected.value.id)
  if (!ok) return
  const next = mass.value.slides[Math.min(idx, mass.value.slides.length - 1)]
  selectedId.value = next?.id ?? null
}

function setMode(mode: SlideMode) {
  if (!selected.value || !mass.value) return
  const patch: Partial<typeof selected.value> = { mode }
  if ((mode === 'hymn-number' || mode === 'hymn-score') && !selected.value.hymn) {
    patch.hymn = { number: '', title: '' }
  }
  if (mode === 'hymn-score' && !selected.value.scoreStyle) {
    const seed =
      [...mass.value.slides]
        .reverse()
        .find((s) => s.mode === 'hymn-score' && s.id !== selected.value!.id)?.scoreStyle ??
      mass.value.scoreStyle
    patch.scoreStyle = cloneResolvedScoreStyle(seed)
  }
  store.updateSlide(massId.value, selected.value.id, patch)
}

/** 선택 중 악보 슬라이드 스타일 패치 (없으면 미사 기본을 시드로 복사) */
function patchScoreStyle(partial: Partial<ScoreStyle>) {
  if (!selected.value || !mass.value || selected.value.mode !== 'hymn-score') return
  const current = styleForSlide(selected.value.scoreStyle, mass.value.scoreStyle)
  const next = { ...current, ...partial }
  const palette = getPalette(next.palette)
  store.updateSlide(massId.value, selected.value.id, { scoreStyle: next })
  // 미사 기본도 최신으로 맞춰, 예전 슬라이드·첫 악보 폴백에 씀
  store.updateMass(massId.value, {
    scoreStyle: next,
    scoreTheme: palette.dark ? 'dark' : 'light',
  })
}

const scoreStyleResolved = computed(() =>
  styleForSlide(selected.value?.scoreStyle, mass.value?.scoreStyle),
)
const canEditScoreStyle = computed(() => selected.value?.mode === 'hymn-score')
const showDetailColors = ref(false)

const scorePage = ref(1)
const scorePageCount = ref(1)

watch(selectedId, () => {
  scorePage.value = 1
  scorePageCount.value = 1
})

function onScorePageCount(count: number) {
  const next = Math.max(1, count)
  if (scorePageCount.value !== next) scorePageCount.value = next
  const clamped = Math.min(Math.max(scorePage.value, 1), scorePageCount.value)
  if (scorePage.value !== clamped) scorePage.value = clamped
}

function setPalette(id: ScorePaletteId) {
  const p = getPalette(id)
  patchScoreStyle({
    palette: id,
    musicColor: p.music,
    chordColor: p.chord,
    lyricsColor: p.lyrics,
    secondaryLyricsColor: p.secondaryLyrics,
  })
}

function setFont(id: ScoreFontId) {
  patchScoreStyle({ fontId: id })
}

function setStaffFilter(id: ScoreStaffFilter) {
  patchScoreStyle({ staffFilter: id })
}

function patchHymn(partial: Partial<HymnRef>) {
  if (!selected.value) return
  store.updateSlide(massId.value, selected.value.id, {
    hymn: {
      number: partial.number ?? selected.value.hymn?.number ?? '',
      title: partial.title ?? selected.value.hymn?.title ?? '',
      musicXmlAssetId: partial.musicXmlAssetId ?? selected.value.hymn?.musicXmlAssetId,
      musicXmlFileName: partial.musicXmlFileName ?? selected.value.hymn?.musicXmlFileName,
      musicXmlUrl: partial.musicXmlUrl ?? selected.value.hymn?.musicXmlUrl,
      scoreAssetId: partial.scoreAssetId ?? selected.value.hymn?.scoreAssetId,
      scoreFileName: partial.scoreFileName ?? selected.value.hymn?.scoreFileName,
      scoreUrl: partial.scoreUrl ?? selected.value.hymn?.scoreUrl,
    },
  })
}
</script>

<template>
  <div class="page">
    <AppHeader :subtitle="mass ? mass.title : '미사 없음'" />

    <main v-if="mass" class="editor">
      <aside class="rail">
        <div class="rail-head">
          <div class="mass-meta">
            <p class="style-caption">미사 정보</p>
            <label class="meta-field">
              <span>이름</span>
              <input
                :value="mass.title"
                @input="
                  patchMassMeta({ title: ($event.target as HTMLInputElement).value })
                "
              />
            </label>
            <label class="meta-field">
              <span>종류</span>
              <select
                :value="mass.kind"
                @change="
                  patchMassMeta({
                    kind: ($event.target as HTMLSelectElement).value as MassKind,
                  })
                "
              >
                <option v-for="k in MASS_KINDS" :key="k" :value="k">{{ k }}</option>
              </select>
            </label>
            <label class="meta-field">
              <span>날짜 · 시간</span>
              <input
                type="datetime-local"
                :value="toDatetimeLocalValue(mass.scheduledAt)"
                @change="
                  patchMassMeta({
                    scheduledAt: fromDatetimeLocalValue(
                      ($event.target as HTMLInputElement).value,
                    ),
                  })
                "
              />
            </label>
            <label class="meta-field">
              <span>장소 메모</span>
              <input
                :value="mass.locationNote ?? ''"
                placeholder="본당 · 어두운 조명"
                @input="
                  patchMassMeta({
                    locationNote: ($event.target as HTMLInputElement).value,
                  })
                "
              />
            </label>
          </div>
          <div class="rail-actions">
            <div class="style-panel" :class="{ disabled: !canEditScoreStyle }">
              <p class="style-caption">
                {{ canEditScoreStyle ? '이 악보 스타일' : '악보 스타일' }}
              </p>
              <p v-if="!canEditScoreStyle" class="style-hint">
                악보 슬라이드를 선택하면 글씨·색을 각각 조절할 수 있습니다.
              </p>
              <fieldset :disabled="!canEditScoreStyle" class="style-fields">
              <div class="palette-row" role="group" aria-label="악보 팔레트">
                <button
                  v-for="p in SCORE_PALETTES"
                  :key="p.id"
                  type="button"
                  class="palette-btn"
                  :class="{ active: scoreStyleResolved.palette === p.id }"
                  :title="p.hint"
                  @click="setPalette(p.id)"
                >
                  <span
                    class="swatch"
                    :style="{ background: `linear-gradient(135deg, ${p.music}, ${p.lyrics})` }"
                  />
                  {{ p.label }}
                </button>
              </div>

              <label class="font-row">
                <span>
                  <strong>가사 폰트</strong>
                  <em>코드 · 가사</em>
                </span>
                <select
                  :value="scoreStyleResolved.fontId"
                  @change="setFont(($event.target as HTMLSelectElement).value as ScoreFontId)"
                >
                  <option v-for="f in SCORE_FONTS" :key="f.id" :value="f.id" :title="f.hint">
                    {{ f.label }}
                  </option>
                </select>
              </label>

              <label class="font-row">
                <span>
                  <strong>성부</strong>
                  <em>4성부 표시</em>
                </span>
                <select
                  :value="scoreStyleResolved.staffFilter"
                  @change="
                    setStaffFilter(($event.target as HTMLSelectElement).value as ScoreStaffFilter)
                  "
                >
                  <option value="all">전체 (트레블+베이스)</option>
                  <option value="treble">트레블만 (윗줄)</option>
                </select>
              </label>

              <label class="opacity-row">
                <span class="scale-label">
                  <strong>가사 크기</strong>
                  <em>{{ Math.round(scoreStyleResolved.lyricsScale * 100) }}%</em>
                </span>
                <input
                  type="range"
                  min="0.8"
                  max="1.8"
                  step="0.05"
                  :value="scoreStyleResolved.lyricsScale"
                  @input="
                    patchScoreStyle({
                      lyricsScale: Number(($event.target as HTMLInputElement).value),
                    })
                  "
                />
              </label>

              <label class="color-row">
                <span>
                  <strong>악보 세트</strong>
                  <em>코드 · 오선 · 음표</em>
                </span>
                <input
                  type="color"
                  :value="scoreStyleResolved.musicColor"
                  @input="
                    patchScoreStyle({
                      musicColor: ($event.target as HTMLInputElement).value,
                      chordColor: ($event.target as HTMLInputElement).value,
                    })
                  "
                />
              </label>
              <label class="color-row">
                <span>
                  <strong>가사 세트</strong>
                  <em>주 가사 · 보조/2절</em>
                </span>
                <input
                  type="color"
                  :value="scoreStyleResolved.lyricsColor"
                  @input="
                    patchScoreStyle({
                      lyricsColor: ($event.target as HTMLInputElement).value,
                      secondaryLyricsColor: ($event.target as HTMLInputElement).value,
                    })
                  "
                />
              </label>

              <button
                type="button"
                class="detail-toggle"
                @click="showDetailColors = !showDetailColors"
              >
                {{ showDetailColors ? '세부 색 닫기' : '세부 색 (코드 / 보조 가사)' }}
              </button>
              <template v-if="showDetailColors">
                <label class="color-row">
                  <span>코드만</span>
                  <input
                    type="color"
                    :value="scoreStyleResolved.chordColor"
                    @input="
                      patchScoreStyle({ chordColor: ($event.target as HTMLInputElement).value })
                    "
                  />
                </label>
                <label class="color-row">
                  <span>보조·2절 가사만</span>
                  <input
                    type="color"
                    :value="scoreStyleResolved.secondaryLyricsColor"
                    @input="
                      patchScoreStyle({
                        secondaryLyricsColor: ($event.target as HTMLInputElement).value,
                      })
                    "
                  />
                </label>
              </template>
              <p class="style-hint">단색만 사용합니다. 새 악보는 직전 악보 스타일을 그대로 물려받습니다.</p>
              </fieldset>
            </div>
            <RouterLink class="btn primary" :to="`/present/${mass.id}`">슬라이드쇼</RouterLink>
          </div>
        </div>

        <ol class="slide-list">
          <li
            v-for="(slide, index) in mass.slides"
            :key="slide.id"
            :class="{ active: slide.id === selectedId }"
          >
            <button type="button" class="slide-item" @click="select(slide.id)">
              <span class="idx">{{ index + 1 }}</span>
              <span class="meta">
                <span class="label">{{ slide.label }}</span>
                <span class="mode">{{ SLIDE_MODE_LABEL[slide.mode] }}</span>
              </span>
              <span v-if="slide.hymn" class="hymn-badge">{{ slide.hymn.number }}</span>
            </button>
          </li>
        </ol>

        <div class="add-panel">
          <p class="add-caption">선택 뒤에 추가</p>
          <div class="add-row">
            <button type="button" class="add-btn" @click="addSlide('black')">+ 블랙</button>
            <button type="button" class="add-btn primary" @click="addSlide('hymn-score')">
              + 악보
            </button>
          </div>
          <div class="add-row">
            <button type="button" class="add-btn" @click="addSlide('hymn-number')">+ 번호</button>
            <button type="button" class="add-btn" @click="addSlide('prayer')">+ 기도</button>
            <button type="button" class="add-btn" @click="addSlide('image')">+ 이미지</button>
          </div>
          <div class="add-row secondary">
            <button type="button" class="add-btn ghost" :disabled="!selected" @click="duplicateSelected">
              복제
            </button>
            <button
              type="button"
              class="add-btn ghost danger"
              :disabled="!selected || mass.slides.length <= 1"
              @click="removeSelected"
            >
              삭제
            </button>
          </div>
        </div>
      </aside>

      <section class="workspace">
        <div class="toolbar">
          <div class="mode-group" role="group" aria-label="표시 방식">
            <button
              v-for="[mode, label] in modes"
              :key="mode"
              type="button"
              class="mode-btn"
              :class="{ active: selected?.mode === mode }"
              :disabled="!selected"
              @click="setMode(mode)"
            >
              {{ label }}
            </button>
          </div>
          <div class="order-group">
            <button type="button" class="btn ghost" :disabled="selectedIndex <= 0" @click="move(-1)">
              위로
            </button>
            <button
              type="button"
              class="btn ghost"
              :disabled="!mass || selectedIndex < 0 || selectedIndex >= mass.slides.length - 1"
              @click="move(1)"
            >
              아래로
            </button>
          </div>
        </div>

        <div v-if="selected" class="preview-wrap">
          <SlideCanvas
            :slide="selected"
            :score-theme="mass.scoreTheme ?? 'dark'"
            :score-style="scoreStyleResolved"
            :score-page="scorePage"
            compact
            @update:score-page="scorePage = $event"
            @score-page-count="onScorePageCount"
          />
          <div v-if="selected.mode === 'hymn-score' && scorePageCount > 1" class="page-nav">
            <button
              type="button"
              class="btn ghost"
              :disabled="scorePage <= 1"
              @click="scorePage -= 1"
            >
              이전 줄
            </button>
            <span class="page-nav-label">{{ scorePage }} / {{ scorePageCount }}</span>
            <button
              type="button"
              class="btn ghost"
              :disabled="scorePage >= scorePageCount"
              @click="scorePage += 1"
            >
              다음 줄
            </button>
          </div>
        </div>
        <p v-else class="empty">왼쪽에서 슬라이드를 선택하세요.</p>

        <div v-if="selected" class="fields">
          <label>
            식순 / 제목
            <input
              :value="selected.label"
              @input="
                store.updateSlide(massId, selected.id, {
                  label: ($event.target as HTMLInputElement).value,
                })
              "
            />
          </label>

          <div v-if="selected.mode === 'hymn-score'" class="spacing-fields">
            <p class="field-caption">음표 간격 · 화면당 줄</p>
            <label class="font-row field-select">
              <span>
                <strong>화면당 줄 수</strong>
                <em>긴 악보를 나눠 보기</em>
              </span>
              <select
                :value="scoreStyleResolved.systemsPerPage"
                @change="
                  patchScoreStyle({
                    systemsPerPage: Number(($event.target as HTMLSelectElement).value),
                  })
                "
              >
                <option :value="1">1줄</option>
                <option :value="2">2줄</option>
                <option :value="3">3줄</option>
                <option :value="4">4줄</option>
              </select>
            </label>
            <label class="field-slider">
              <span class="scale-label">
                <strong>시가 대비</strong>
                <em>{{ scoreStyleResolved.spacingNonLinear.toFixed(2) }}</em>
              </span>
              <input
                type="range"
                min="0.15"
                max="1"
                step="0.05"
                :value="scoreStyleResolved.spacingNonLinear"
                @input="
                  patchScoreStyle({
                    spacingNonLinear: Number(($event.target as HTMLInputElement).value),
                  })
                "
              />
              <span class="slider-hint">낮을수록 긴·짧은 음 칸 차이 ↓ · 1이면 시가 그대로</span>
            </label>
            <label class="field-slider">
              <span class="scale-label">
                <strong>가로 밀도</strong>
                <em>{{ scoreStyleResolved.spacingLinear.toFixed(2) }}</em>
              </span>
              <input
                type="range"
                min="0.02"
                max="0.4"
                step="0.01"
                :value="scoreStyleResolved.spacingLinear"
                @input="
                  patchScoreStyle({
                    spacingLinear: Number(($event.target as HTMLInputElement).value),
                  })
                "
              />
              <span class="slider-hint">높을수록 전체 더 넓게</span>
            </label>
          </div>

          <label v-if="selected.mode === 'prayer' || selected.mode === 'order' || selected.mode === 'title'">
            본문
            <textarea
              rows="4"
              :value="selected.body ?? ''"
              @input="
                store.updateSlide(massId, selected.id, {
                  body: ($event.target as HTMLTextAreaElement).value,
                })
              "
            />
          </label>

          <div v-if="selected.mode === 'image'" class="upload-block">
            <p class="field-caption">인트로·배경 이미지</p>
            <FileDropField
              kind="image"
              :file-name="selected.imageFileName"
              @uploaded="store.replaceSlideAsset(massId, selected.id, 'image', $event)"
              @cleared="store.replaceSlideAsset(massId, selected.id, 'image', null)"
            />
          </div>

          <div v-if="selected.mode === 'hymn-number' || selected.mode === 'hymn-score'" class="hymn-fields">
            <label>
              성가 번호
              <input
                :value="selected.hymn?.number ?? ''"
                @input="patchHymn({ number: ($event.target as HTMLInputElement).value })"
              />
            </label>
            <label>
              성가 제목
              <input
                :value="selected.hymn?.title ?? ''"
                @input="patchHymn({ title: ($event.target as HTMLInputElement).value })"
              />
            </label>
          </div>

          <div v-if="selected.mode === 'hymn-score'" class="upload-block">
            <p class="field-caption">악보 (MusicXML) — 권장</p>
            <FileDropField
              kind="musicxml"
              :file-name="selected.hymn?.musicXmlFileName"
              hint="컴퓨터에서 .musicxml / .mxl 파일을 골라 주세요. MuseScore 등에서 내보낸 파일이면 됩니다."
              @uploaded="store.replaceSlideAsset(massId, selected.id, 'musicXml', $event)"
              @cleared="store.replaceSlideAsset(massId, selected.id, 'musicXml', null)"
            />
            <p class="or-line">또는 악보 이미지</p>
            <FileDropField
              kind="image"
              :file-name="selected.hymn?.scoreFileName"
              hint="MusicXML이 없을 때만 사용합니다 (PNG, JPG 등)."
              @uploaded="store.replaceSlideAsset(massId, selected.id, 'scoreImage', $event)"
              @cleared="store.replaceSlideAsset(massId, selected.id, 'scoreImage', null)"
            />
          </div>
        </div>
      </section>
    </main>

    <main v-else class="missing">
      <p>해당 미사를 찾을 수 없습니다.</p>
      <RouterLink class="btn primary" to="/">목록으로</RouterLink>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.editor {
  display: grid;
  grid-template-columns: minmax(240px, 300px) 1fr;
  min-height: calc(100vh - 4.5rem);
}

.rail {
  border-right: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 70%, var(--bg));
  padding: 1.25rem 1rem 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.rail-head {
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  padding: 0 0.35rem;
}

.mass-meta {
  display: grid;
  gap: 0.45rem;
  padding: 0.65rem 0.55rem;
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  background: var(--surface);
}

.meta-field {
  display: grid;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: var(--muted);
}

.meta-field span {
  font-weight: 600;
  letter-spacing: 0.02em;
}

.meta-field input,
.meta-field select {
  font: inherit;
  font-size: 0.85rem;
  color: var(--ink);
  background: var(--bg);
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  padding: 0.4rem 0.5rem;
  width: 100%;
  box-sizing: border-box;
}

.meta-field input[type='datetime-local'] {
  font-variant-numeric: tabular-nums;
  min-height: 2.1rem;
}

.rail-actions {
  display: flex;
  flex-direction: column;
  gap: 0.55rem;
}

.style-panel {
  display: grid;
  gap: 0.45rem;
  padding: 0.65rem 0.55rem;
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  background: var(--surface);
}

.style-panel.disabled {
  opacity: 0.72;
}

.style-fields {
  display: grid;
  gap: 0.45rem;
  margin: 0;
  padding: 0;
  border: none;
  min-width: 0;
}

.style-fields:disabled {
  pointer-events: none;
}

.style-caption {
  margin: 0;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--muted);
  font-weight: 600;
}

.palette-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.palette-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  border: 1px solid var(--line);
  background: var(--bg);
  color: var(--ink);
  border-radius: 0.35rem;
  padding: 0.28rem 0.45rem;
  font: inherit;
  font-size: 0.72rem;
  cursor: pointer;
}

.palette-btn.active {
  border-color: var(--ink);
  background: var(--ink);
  color: var(--bg);
}

.swatch {
  width: 0.7rem;
  height: 0.7rem;
  border-radius: 50%;
  flex-shrink: 0;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.15);
}

.color-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--muted);
}

.font-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.72rem;
  color: var(--muted);
}

.font-row span {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.font-row strong {
  color: var(--ink);
  font-weight: 600;
}

.font-row em {
  font-style: normal;
  opacity: 0.85;
  font-size: 0.65rem;
}

.font-row select {
  flex: 1;
  min-width: 0;
  max-width: 11rem;
  font: inherit;
  font-size: 0.72rem;
  padding: 0.28rem 0.35rem;
  border: 1px solid var(--line);
  border-radius: 0.3rem;
  background: var(--bg);
  color: var(--ink);
  cursor: pointer;
}

.color-row span {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
  min-width: 0;
}

.color-row strong {
  color: var(--ink);
  font-weight: 600;
}

.color-row em {
  font-style: normal;
  opacity: 0.85;
  font-size: 0.65rem;
}

.color-row input[type='color'] {
  width: 2.1rem;
  height: 1.6rem;
  padding: 0;
  border: 1px solid var(--line);
  border-radius: 0.3rem;
  background: transparent;
  cursor: pointer;
}

.detail-toggle {
  border: none;
  background: transparent;
  color: var(--muted);
  font: inherit;
  font-size: 0.7rem;
  text-align: left;
  padding: 0.15rem 0;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.opacity-row {
  display: grid;
  gap: 0.2rem;
  font-size: 0.72rem;
  color: var(--muted);
}

.opacity-row .scale-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.opacity-row .scale-label strong {
  color: var(--ink);
  font-weight: 600;
}

.opacity-row .scale-label em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
}

.opacity-row input[type='range'] {
  width: 100%;
  accent-color: var(--ink);
}

.slider-hint {
  font-size: 0.65rem;
  line-height: 1.3;
  color: var(--muted);
  opacity: 0.9;
}

.style-hint {
  margin: 0;
  font-size: 0.68rem;
  color: var(--muted);
  line-height: 1.35;
}

.theme-toggle {
  display: flex;
  gap: 0.35rem;
}

.eyebrow {
  margin: 0 0 0.25rem;
  font-size: 0.72rem;
  letter-spacing: 0.06em;
  color: var(--accent-ink);
}

.rail-head h1 {
  margin: 0;
  font-family: var(--font-display);
  font-size: 1.25rem;
  letter-spacing: -0.02em;
}

.when {
  margin: 0.35rem 0 0;
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.4;
}

.slide-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.add-panel {
  display: grid;
  gap: 0.4rem;
  padding: 0.65rem 0.35rem 0.25rem;
  border-top: 1px solid var(--line);
  margin-top: 0.35rem;
  flex-shrink: 0;
}

.add-caption {
  margin: 0;
  font-size: 0.68rem;
  color: var(--muted);
  letter-spacing: 0.02em;
}

.add-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.add-row.secondary {
  margin-top: 0.15rem;
}

.add-btn {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 0.35rem;
  padding: 0.35rem 0.55rem;
  font: inherit;
  font-size: 0.75rem;
  font-weight: 600;
  cursor: pointer;
}

.add-btn:hover:not(:disabled) {
  background: var(--surface-2);
}

.add-btn.primary {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}

.add-btn.primary:hover:not(:disabled) {
  opacity: 0.92;
}

.add-btn.ghost {
  background: transparent;
  font-weight: 500;
  color: var(--muted);
}

.add-btn.danger:hover:not(:disabled) {
  color: #a33;
  border-color: color-mix(in srgb, #a33 35%, var(--line));
}

.add-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.slide-item {
  width: 100%;
  display: grid;
  grid-template-columns: 1.6rem 1fr auto;
  gap: 0.55rem;
  align-items: center;
  text-align: left;
  padding: 0.65rem 0.55rem;
  border: 1px solid transparent;
  border-radius: 0.5rem;
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
}

.slide-item:hover {
  background: var(--surface-2);
}

.active .slide-item {
  background: var(--surface);
  border-color: var(--line);
  box-shadow: 0 1px 0 color-mix(in srgb, var(--ink) 4%, transparent);
}

.idx {
  font-size: 0.75rem;
  color: var(--muted);
  font-variant-numeric: tabular-nums;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
  min-width: 0;
}

.label {
  font-size: 0.9rem;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mode {
  font-size: 0.72rem;
  color: var(--muted);
}

.hymn-badge {
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--accent-ink);
  background: var(--accent-soft);
  padding: 0.15rem 0.4rem;
  border-radius: 0.3rem;
}

.workspace {
  padding: 1.25rem 1.5rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: space-between;
  align-items: center;
}

.mode-group,
.order-group {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}

.mode-btn {
  border: 1px solid var(--line);
  background: var(--surface);
  color: var(--ink);
  border-radius: 0.4rem;
  padding: 0.4rem 0.7rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
}

.mode-btn:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--accent) 45%, var(--line));
}

.mode-btn.active {
  background: var(--ink);
  color: var(--bg);
  border-color: var(--ink);
}

.mode-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.preview-wrap {
  width: min(100%, 920px);
}

.page-nav {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  margin-top: 0.55rem;
}

.page-nav-label {
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
  min-width: 4rem;
  text-align: center;
}

.fields {
  display: grid;
  gap: 0.85rem;
  width: min(100%, 920px);
}

.field-select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.field-select span {
  display: flex;
  flex-direction: column;
  gap: 0.05rem;
}

.field-select strong {
  color: var(--ink);
  font-weight: 600;
}

.field-select em {
  font-style: normal;
  opacity: 0.85;
  font-size: 0.7rem;
}

.field-select select {
  font: inherit;
  font-size: 0.8rem;
  padding: 0.35rem 0.45rem;
  border: 1px solid var(--line);
  border-radius: 0.35rem;
  background: var(--bg);
  color: var(--ink);
}

.field-caption {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 600;
}

.spacing-fields {
  display: grid;
  gap: 0.65rem;
  padding: 0.75rem 0.85rem;
  border: 1px solid var(--line);
  border-radius: 0.5rem;
  background: var(--surface);
}

.field-slider {
  display: grid;
  gap: 0.25rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.field-slider .scale-label {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem;
}

.field-slider .scale-label strong {
  color: var(--ink);
  font-weight: 600;
}

.field-slider .scale-label em {
  font-style: normal;
  font-variant-numeric: tabular-nums;
}

.field-slider input[type='range'] {
  width: 100%;
  accent-color: var(--ink);
}

.field-slider .slider-hint {
  font-size: 0.7rem;
  line-height: 1.35;
  color: var(--muted);
}

.upload-block {
  display: grid;
  gap: 0.55rem;
}

.or-line {
  margin: 0.35rem 0 0;
  font-size: 0.78rem;
  color: var(--muted);
  text-align: center;
}

.fields label {
  display: grid;
  gap: 0.35rem;
  font-size: 0.8rem;
  color: var(--muted);
}

.fields input,
.fields textarea {
  font: inherit;
  color: var(--ink);
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 0.45rem;
  padding: 0.6rem 0.75rem;
  resize: vertical;
}

.hymn-fields {
  display: grid;
  grid-template-columns: 8rem 1fr;
  gap: 0.75rem;
}

.empty,
.missing {
  padding: 3rem 1.5rem;
  color: var(--muted);
}

.missing {
  display: grid;
  gap: 1rem;
  justify-items: start;
}

@media (max-width: 900px) {
  .editor {
    grid-template-columns: 1fr;
  }

  .rail {
    border-right: none;
    border-bottom: 1px solid var(--line);
  }

  .hymn-fields {
    grid-template-columns: 1fr;
  }
}
</style>
