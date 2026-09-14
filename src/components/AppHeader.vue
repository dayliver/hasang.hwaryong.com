<script setup lang="ts">
import { RouterLink } from 'vue-router'

defineProps<{
  subtitle?: string
}>()
</script>

<template>
  <header class="app-header">
    <div class="brand">
      <RouterLink to="/" class="brand-link">
        <span class="brand-mark" aria-hidden="true" />
        <span class="brand-text">
          <span class="brand-name">성정하상바울로성당</span>
          <span class="brand-sub">미사 슬라이드</span>
        </span>
      </RouterLink>
    </div>
    <p v-if="subtitle" class="header-sub">{{ subtitle }}</p>
    <nav class="header-nav">
      <RouterLink to="/">미사 목록</RouterLink>
    </nav>
  </header>
</template>

<style scoped>
.app-header {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem 1.75rem;
  border-bottom: 1px solid var(--line);
  background: color-mix(in srgb, var(--surface) 88%, transparent);
  backdrop-filter: blur(10px);
  position: sticky;
  top: 0;
  z-index: 10;
}

.brand-link {
  display: flex;
  align-items: center;
  gap: 0.85rem;
  text-decoration: none;
  color: inherit;
}

.brand-mark {
  width: 2.4rem;
  height: 2.4rem;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 30%, #f3e6c4 0 18%, transparent 19%),
    conic-gradient(from 210deg, var(--accent) 0 25%, var(--ink) 25% 50%, var(--accent) 50% 75%, var(--ink) 75%);
  box-shadow: inset 0 0 0 2px color-mix(in srgb, var(--accent) 55%, white);
  flex-shrink: 0;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.15;
}

.brand-name {
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  letter-spacing: -0.02em;
}

.brand-sub {
  font-size: 0.75rem;
  color: var(--muted);
  letter-spacing: 0.04em;
}

.header-sub {
  margin: 0;
  flex: 1;
  color: var(--muted);
  font-size: 0.9rem;
}

.header-nav {
  margin-left: auto;
}

.header-nav a {
  color: var(--ink);
  text-decoration: none;
  font-size: 0.9rem;
  padding: 0.35rem 0.7rem;
  border-radius: 0.4rem;
}

.header-nav a:hover,
.header-nav a.router-link-active {
  background: var(--surface-2);
}

@media (max-width: 640px) {
  .app-header {
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .header-sub {
    order: 3;
    flex-basis: 100%;
  }
}
</style>
