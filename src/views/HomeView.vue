<script setup lang="ts">
import { computed, ref } from 'vue'
import { RouterLink, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import {
  askEditPassword,
  deleteRemoteMass,
  fetchRemoteMasses,
  uploadBundleToServer,
} from '../lib/api'
import {
  applyMassBundleAssets,
  buildMassBundle,
  buildSingleMassBundle,
  downloadMassBundle,
  readBundleFromFile,
  summarizeBundle,
} from '../lib/massBundle'
import { enterSlideshowFullscreen } from '../lib/present'
import { useMassStore } from '../stores/mass'
import type { MassSession } from '../types/mass'

const router = useRouter()
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

function createMass() {
  const mass = store.createMass()
  message.value = `「${mass.title}」을(를) 만들었습니다. 편집에서 이름·일시를 바꾸세요.`
}

async function removeMass(mass: MassSession) {
  if (busy.value) return
  const ok = window.confirm(
    `「${mass.title}」을(를) 삭제할까요?\n서버(D1)와 이 기기에서 함께 지워집니다.`,
  )
  if (!ok) return

  const password = askEditPassword()
  if (password === null) return

  busy.value = true
  message.value = ''
  try {
    await deleteRemoteMass(mass.id, password)
    store.removeMass(mass.id)
    message.value = `「${mass.title}」을(를) 서버에서 삭제했습니다.`
  } catch (err) {
    message.value = err instanceof Error ? err.message : '삭제에 실패했습니다.'
    console.error(err)
  } finally {
    busy.value = false
  }
}

async function refreshFromServer() {
  const remote = await fetchRemoteMasses()
  if (remote) store.replaceAllMasses(remote)
}

async function pushLocalToServer() {
  if (busy.value) return
  const list = store.list()
  if (!list.length) {
    message.value = '올릴 미사가 없습니다.'
    return
  }
  const password = askEditPassword('서버에 올릴 편집 비밀번호를 입력하세요.')
  if (password === null) return

  busy.value = true
  message.value = ''
  try {
    const bundle = await buildMassBundle([...list])
    const result = await uploadBundleToServer(bundle, password)
    await refreshFromServer()
    message.value = `서버 반영 완료 — 미사 ${result.masses}개 · 파일 ${result.assets}개`
  } catch (err) {
    message.value = err instanceof Error ? err.message : '서버 반영에 실패했습니다.'
    console.error(err)
  } finally {
    busy.value = false
  }
}

async function startSlideshow(mass: MassSession) {
  await enterSlideshowFullscreen()
  await router.push(`/present/${mass.id}`)
}

function pickImport() {
  importInput.value?.click()
}

async function onImportFile(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file || busy.value) return

  const password = askEditPassword('JSON을 서버(D1)에 저장할 편집 비밀번호를 입력하세요.')
  if (password === null) return

  busy.value = true
  message.value = ''
  try {
    const bundle = await readBundleFromFile(file)
    await uploadBundleToServer(bundle, password)
    await applyMassBundleAssets(bundle)
    await refreshFromServer()
    message.value = `서버 저장 완료 — ${summarizeBundle(bundle)} (같은 id면 덮어씀)`
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
    <AppHeader subtitle="미사 자료를 만들고 보내고 가져옵니다" />

    <main class="main">
      <section class="intro">
        <h1>미사 관리</h1>
        <p>
          새 미사·가져오기·삭제·편집은 여기서 합니다. 성당 투영용 목록은
          <RouterLink to="/">홈</RouterLink>에 있고, 거기서만 슬라이드쇼(전체화면)를
          시작합니다.
        </p>
      </section>

      <section class="backup-panel" aria-label="자료 가져오기">
        <div class="backup-actions">
          <button type="button" class="btn primary" :disabled="busy" @click="createMass">
            새 미사
          </button>
          <button type="button" class="btn ghost" :disabled="busy" @click="pickImport">
            미사 가져오기 (JSON → D1)
          </button>
          <button type="button" class="btn ghost" :disabled="busy" @click="pushLocalToServer">
            이 기기 → 서버
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
          JSON 가져오기와 「이 기기 → 서버」는 Cloudflare D1에 저장됩니다. 다른
          브라우저·기기는 홈에서 같은 목록을 봅니다. 쓰기에는 편집 비밀번호가
          필요합니다.
        </p>
        <p v-if="message" class="backup-msg">{{ message }}</p>
      </section>

      <section class="mass-list" aria-label="저장된 미사">
        <p v-if="masses.length === 0" class="empty-list">저장된 미사가 없습니다.</p>
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
            <button
              type="button"
              class="btn primary"
              :disabled="busy"
              @click="startSlideshow(mass)"
            >
              슬라이드쇼
            </button>
            <button
              type="button"
              class="btn ghost danger"
              :disabled="busy"
              @click="removeMass(mass)"
            >
              삭제
            </button>
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

.empty-list {
  margin: 0;
  padding: 1.5rem 0;
  color: var(--muted);
  font-size: 0.92rem;
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

.btn.danger {
  color: #a33;
}

.btn.danger:hover:not(:disabled) {
  border-color: color-mix(in srgb, #a33 40%, var(--line));
  background: color-mix(in srgb, #a33 8%, transparent);
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
