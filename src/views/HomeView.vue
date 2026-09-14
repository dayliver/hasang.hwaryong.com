<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { useMassStore } from '../stores/mass'

const store = useMassStore()
const masses = computed(() =>
  [...store.list()].sort(
    (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
  ),
)

function formatWhen(iso: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(iso))
}
</script>

<template>
  <div class="page">
    <AppHeader subtitle="미사 시간에 맞춰 슬라이드를 저장하고 투사합니다" />

    <main class="main">
      <section class="intro">
        <h1>미사 슬라이드</h1>
        <p>
          식순 · 성가 번호 · OSMD 악보 · 블랙 · 이미지를 순서대로 구성한 뒤,
          해당 미사 시간에 슬라이드쇼로 띄웁니다. 떼제 미사는 인트로 → 블랙 → 악보 패턴을 씁니다.
        </p>
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
          <li><strong>성가 악보</strong> — OSMD(MusicXML) · 다크/라이트</li>
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
