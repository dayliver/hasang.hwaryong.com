<script setup lang="ts">
import { computed, ref, watch } from 'vue'

const props = withDefaults(
  defineProps<{
    src?: string | null
    alt?: string
    /** IndexedDB 등에서 불러오는 중 */
    loading?: boolean
    inverted?: boolean
    label?: string
  }>(),
  {
    alt: '',
    loading: false,
    inverted: false,
    label: '이미지',
  },
)

const loaded = ref(false)
const failed = ref(false)

watch(
  () => props.src,
  () => {
    loaded.value = false
    failed.value = false
  },
)

function onLoad() {
  loaded.value = true
  failed.value = false
}

function onError() {
  loaded.value = false
  failed.value = true
}

const showSkeleton = computed(
  () => props.loading || !props.src || failed.value || (!loaded.value && !!props.src),
)

const skeletonText = computed(() => {
  if (props.loading) return '불러오는 중…'
  if (!props.src || failed.value) return `${props.label}를 올려 주세요`
  return '준비 중…'
})
</script>

<template>
  <div class="slide-image" :class="{ inverted }">
    <div v-if="showSkeleton" class="skeleton" aria-hidden="true">
      <div class="shimmer" />
      <p class="skeleton-label">{{ skeletonText }}</p>
    </div>
    <img
      v-if="src && !failed"
      class="media"
      :class="{ ready: loaded }"
      :src="src"
      :alt="alt"
      @load="onLoad"
      @error="onError"
    />
  </div>
</template>

<style scoped>
.slide-image {
  position: relative;
  width: 100%;
  height: 100%;
  min-height: 10rem;
  overflow: hidden;
  background: #0a0e0c;
}

.media {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
  opacity: 0;
  transition: opacity 0.2s ease;
}

.media.ready {
  opacity: 1;
}

.inverted .media {
  filter: invert(1) contrast(1.05);
  object-fit: contain;
}

.skeleton {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background:
    linear-gradient(165deg, #121a17 0%, #0a0e0c 55%, #101612 100%);
}

.shimmer {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    100deg,
    transparent 20%,
    rgba(244, 239, 228, 0.06) 40%,
    transparent 60%
  );
  background-size: 200% 100%;
  animation: shimmer 1.4s ease-in-out infinite;
}

.skeleton-label {
  position: relative;
  z-index: 1;
  margin: 0;
  padding: 0 1.5rem;
  text-align: center;
  font-size: 0.95rem;
  color: rgba(244, 239, 228, 0.55);
  letter-spacing: 0.02em;
}

@keyframes shimmer {
  0% {
    background-position: 100% 0;
  }
  100% {
    background-position: -100% 0;
  }
}
</style>
