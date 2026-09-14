<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter, RouterLink } from 'vue-router'
import SlideCanvas from '../components/SlideCanvas.vue'
import { useMassStore } from '../stores/mass'

const route = useRoute()
const router = useRouter()
const store = useMassStore()

const massId = computed(() => String(route.params.id))
const mass = computed(() => store.getById(massId.value))

const index = ref(0)
/** Esc로 토글. 미사 중엔 숨기고, 필요할 때만 조작·편집 */
const showHud = ref(false)

const slide = computed(() => mass.value?.slides[index.value])
const total = computed(() => mass.value?.slides.length ?? 0)

function go(delta: number) {
  if (!mass.value) return
  index.value = Math.min(Math.max(index.value + delta, 0), total.value - 1)
}

function goEdit() {
  if (!mass.value) return
  void router.push(`/edit/${mass.value.id}`)
}

function onKey(e: KeyboardEvent) {
  if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
    e.preventDefault()
    go(1)
  } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
    e.preventDefault()
    go(-1)
  } else if (e.key === 'Home') {
    index.value = 0
  } else if (e.key === 'End' && total.value) {
    index.value = total.value - 1
  } else if (e.key === 'Escape') {
    showHud.value = !showHud.value
  } else if ((e.key === 'e' || e.key === 'E') && showHud.value) {
    // HUD가 열린 상태에서만 — 미사 중 실수 입력 방지
    e.preventDefault()
    goEdit()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKey)
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKey)
})
</script>

<template>
  <div class="presenter" @click="go(1)">
    <template v-if="mass && slide">
      <SlideCanvas
        :slide="slide"
        :score-theme="mass.scoreTheme ?? 'dark'"
        :score-style="mass.scoreStyle"
        presenting
        class="full"
      />

      <div v-show="showHud" class="hud" @click.stop>
        <button type="button" class="hud-edit" @click="goEdit">
          편집으로
          <kbd>E</kbd>
        </button>
        <p class="progress">{{ index + 1 }} / {{ total }} · {{ mass.title }}</p>
        <div class="nav">
          <button type="button" class="btn ghost" :disabled="index === 0" @click="go(-1)">이전</button>
          <button type="button" class="btn primary" :disabled="index >= total - 1" @click="go(1)">
            다음
          </button>
        </div>
      </div>
      <p v-show="showHud" class="hint">← → / Space · Esc로 조작 UI 닫기</p>
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
