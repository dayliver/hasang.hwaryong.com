<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, RouterLink } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import FileDropField from '../components/FileDropField.vue'
import SlideCanvas from '../components/SlideCanvas.vue'
import { useMassStore } from '../stores/mass'
import { SLIDE_MODE_LABEL, type HymnRef, type ScoreFontId, type ScorePaletteId, type ScoreStaffFilter, type ScoreStyle, type SlideMode } from '../types/mass'
import { DEFAULT_SCORE_STYLE, SCORE_PALETTES, getPalette, resolveScoreStyle } from '../lib/scoreStyle'
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
  if (!selected.value) return
  store.updateSlide(massId.value, selected.value.id, { mode })
}

function patchScoreStyle(partial: Partial<ScoreStyle>) {
  const current = resolveScoreStyle(mass.value?.scoreStyle)
  const next = { ...current, ...partial }
  const palette = getPalette(next.palette)
  store.updateMass(massId.value, {
    scoreStyle: next,
    scoreTheme: palette.dark ? 'dark' : 'light',
  })
}

const scoreStyleResolved = computed(() => resolveScoreStyle(mass.value?.scoreStyle))
const showDetailColors = ref(false)

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

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    dateStyle: 'full',
    timeStyle: 'short',
  }).format(new Date(iso))
}
</script>

<template>
  <div class="page">
    <AppHeader :subtitle="mass ? mass.title : '미사 없음'" />

    <main v-if="mass" class="editor">
      <aside class="rail">
        <div class="rail-head">
          <div>
            <p class="eyebrow">{{ mass.kind }}</p>
            <h1>{{ mass.title }}</h1>
            <p class="when">{{ formatWhen(mass.scheduledAt) }}</p>
          </div>
          <div class="rail-actions">
            <div class="style-panel">
              <p class="style-caption">악보 색</p>
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
              <p class="style-hint">단색만 사용합니다. 투명도는 겹친 벡터가 지저분해져서 쓰지 않습니다.</p>
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
            :score-style="mass.scoreStyle ?? DEFAULT_SCORE_STYLE"
            compact
          />
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

.fields {
  display: grid;
  gap: 0.85rem;
  width: min(100%, 920px);
}

.field-caption {
  margin: 0 0 0.45rem;
  font-size: 0.8rem;
  color: var(--muted);
  font-weight: 600;
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
