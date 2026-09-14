import { createApp } from 'vue'
import './style.css'
import './styles/score-fonts.css'
import App from './App.vue'
import router from './router'
import { applyMassBundleAssets, fetchPublicBundle } from './lib/massBundle'
import { useMassStore } from './stores/mass'

async function boot() {
  const store = useMassStore()
  // 로컬에 저장된 미사가 없을 때만 리포의 정적 번들로 시드
  if (!store.hasPersistedMasses()) {
    const bundle = await fetchPublicBundle()
    if (bundle) {
      await applyMassBundleAssets(bundle)
      store.replaceAllMasses(bundle.masses)
    }
  }

  createApp(App).use(router).mount('#app')
}

void boot()
