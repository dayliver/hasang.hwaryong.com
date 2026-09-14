<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
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

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}

async function startSlideshow(mass: MassSession) {
  if (busy.value) return
  busy.value = true
  try {
    await enterSlideshowFullscreen()
    await router.push(`/present/${mass.id}`)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="page">
    <AppHeader subtitle="미사를 고른 뒤 슬라이드쇼로 투사합니다" />

    <main class="main">
      <section class="intro">
        <h1>미사 목록</h1>
        <p>슬라이드쇼를 누르면 전체 화면으로 투영을 시작합니다.</p>
      </section>

      <section class="mass-list" aria-label="미사 목록">
        <p v-if="masses.length === 0" class="empty-list">표시할 미사가 없습니다.</p>
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
            <button
              type="button"
              class="btn primary"
              :disabled="busy"
              @click="startSlideshow(mass)"
            >
              슬라이드쇼
            </button>
          </div>
        </article>
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
  max-width: 36rem;
  color: var(--muted);
  line-height: 1.65;
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
  gap: 0.5rem;
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
