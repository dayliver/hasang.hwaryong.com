<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import {
  BUNDLE_PUBLIC_PATH,
  applyMassBundleAssets,
  buildSingleMassBundle,
  downloadMassBundle,
  readBundleFromFile,
  summarizeBundle,
} from '../lib/massBundle'
import { useMassStore } from '../stores/mass'
import type { MassSession } from '../types/mass'

const store = useMassStore()
const masses = computed(() =>
  [...store.list()].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  ),
)

const busy = ref(false)
const message = ref('')
const importInput = ref<HTMLInputElement | null>(null)

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

async function exportMass(mass: MassSession) {
  if (busy.value) return
  busy.value = true
  message.value = ''
  try {
    const bundle = await buildSingleMassBundle(mass)
    downloadMassBundle(bundle)
    message.value = `보내기 완료 — ${summarizeBundle(bundle)}`
  } catch (err) {
    message.value = err instanceof Error ? err.message : '보내기에 실패했습니다.'
    console.error(err)
  } finally {
    busy.value = false
  }
}

function pickImport() {
  importInput.value?.click()
}

async function onImportFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return
  busy.value = true
  message.value = ''
  try {
    const bundle = await readBundleFromFile(file)
    await applyMassBundleAssets(bundle)
    store.upsertMasses(bundle.masses)
    message.value = `가져오기 완료 — ${summarizeBundle(bundle)} (같은 id면 덮어씀)`
  } catch (err) {
    message.value = err instanceof Error ? err.message : '가져오기에 실패했습니다.'
    console.error(err)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppHeader subtitle="미사 시간에 맞춰 슬라이드를 저장하고 투사합니다" />

    <main class="main">
      <section class="intro">
        <h1>미사 슬라이드</h1>
        <p>
          식순 · 성가 번호 · 악보(MusicXML) · 블랙 · 이미지를 순서대로 구성한 뒤,
          해당 미사 시간에 슬라이드쇼로 띄웁니다. 미사마다 JSON으로 보내고 가져올 수
          있습니다.
        </p>
      </section>

      <section class="backup-panel" aria-label="자료 가져오기">
        <div class="backup-actions">
          <button type="button" class="btn primary" :disabled="busy" @click="pickImport">
            미사 가져오기 (JSON)
          </button>
          <input
            ref="importInput"
            type="file"
            accept="application/json,.json"
            class="sr-only"
            @change="onImportFile"
          />
        </div>
        <p class="backup-hint">
          각 미사 행의 <strong>보내기</strong>로 한 미사만 JSON으로 받습니다. 가져온 미사
          파일을 <code>public/data/hasang-bundle.json</code>
          (<code>{{ BUNDLE_PUBLIC_PATH }}</code>) 에 두면, 로컬 자료가 없는 기기에서 자동
          시드됩니다. 같은 id면 덮어씁니다.
        </p>
        <p v-if="message" class="backup-msg">{{ message }}</p>
      </section>

      <section class="mass-list" aria-label="저장된 미사">
        <article v-for="mass in masses" :key="mass.id" class="mass-row">
          <div class="mass-when">
            <time :datetime="mass.scheduledAt">{{ formatWhen(mass.scheduledAt) }}</time>
            <span class="kind">{{ mass.kind }}</span>
          </div>
          <div class="mass-info">
            <h2>{{ mass.title }}</h2>
            <p>
              슬라이드 {{ mass.slides.length }}장
              <template v-if="mass.locationNote"> · {{ mass.locationNote }}</template>
            </p>
          </div>
          <div class="mass-actions">
            <button type="button" class="btn ghost" :disabled="busy" @click="exportMass(mass)">
              보내기
            </button>
            <RouterLink class="btn ghost" :to="`/edit/${mass.id}`">편집</RouterLink>
            <RouterLink class="btn primary" :to="`/present/${mass.id}`">슬라이드쇼</RouterLink>
          </div>
        </article>
      </section>

      <section class="modes-hint">
        <h2>슬라이드 방식</h2>
        <ul>
          <li><strong>이미지</strong> — 인트로 등 전체 화면</li>
          <li><strong>블랙</strong> — 침묵·전환용 검정 화면</li>
          <li><strong>성가 악보</strong> — Verovio(MusicXML) · 다크/라이트</li>
          <li><strong>성가 번호 · 기도문 · 식순</strong> — 기존 방식</li>
        </ul>
      </section>
    </main>
  </div>
</template>

<style scoped>
.page {
  min-height: 100vh;
}

.main {
  width: min(960px, calc(100% - 2rem));
  margin: 0 auto;
  padding: 2.25rem 0 4rem;
  display: grid;
  gap: 2.5rem;
}

.intro h1 {
  margin: 0 0 0.6rem;
  font-family: var(--font-display);
  font-size: clamp(1.75rem, 4vw, 2.35rem);
  letter-spacing: -0.03em;
}

.intro p {
  margin: 0;
  max-width: 40rem;
  color: var(--muted);
  line-height: 1.65;
}

.backup-panel {
  display: grid;
  gap: 0.55rem;
  padding: 1rem 1.1rem;
  border: 1px solid var(--line);
  border-radius: 0.55rem;
  background: var(--surface);
}

.backup-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.backup-hint {
  margin: 0;
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.45;
}

.backup-hint code {
  font-size: 0.78rem;
}

.backup-msg {
  margin: 0;
  font-size: 0.85rem;
  color: var(--ink);
  line-height: 1.4;
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

.mass-list {
  display: flex;
  flex-direction: column;
  gap: 0;
  border-top: 1px solid var(--line);
}

.mass-row {
  display: grid;
  grid-template-columns: 11rem 1fr auto;
  gap: 1.25rem;
  align-items: center;
  padding: 1.25rem 0;
  border-bottom: 1px solid var(--line);
}

.mass-when {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.mass-when time {
  font-size: 0.92rem;
  font-weight: 600;
}

.kind {
  width: fit-content;
  font-size: 0.72rem;
  letter-spacing: 0.04em;
  color: var(--accent-ink);
  background: var(--accent-soft);
  padding: 0.15rem 0.45rem;
  border-radius: 0.3rem;
}

.mass-info h2 {
  margin: 0 0 0.25rem;
  font-size: 1.1rem;
  font-family: var(--font-display);
  font-weight: 700;
}

.mass-info p {
  margin: 0;
  color: var(--muted);
  font-size: 0.88rem;
}

.mass-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.modes-hint {
  padding: 1.25rem 0 0;
}

.modes-hint h2 {
  margin: 0 0 0.75rem;
  font-size: 0.85rem;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--muted);
  font-weight: 600;
}

.modes-hint ul {
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem 1.5rem;
}

.modes-hint li {
  font-size: 0.92rem;
  line-height: 1.45;
  color: var(--muted);
}

.modes-hint strong {
  color: var(--ink);
  font-weight: 600;
}

@media (max-width: 720px) {
  .mass-row {
    grid-template-columns: 1fr;
    gap: 0.75rem;
  }

  .mass-actions {
    justify-content: flex-start;
  }
}
</style>
