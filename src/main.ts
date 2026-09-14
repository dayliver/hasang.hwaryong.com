import { createApp } from 'vue'
import './style.css'
import './styles/score-fonts.css'
import App from './App.vue'
import router from './router'
import { fetchRemoteMasses } from './lib/api'
import { useMassStore } from './stores/mass'

async function boot() {
  const store = useMassStore()
  const remote = await fetchRemoteMasses()
  if (remote === null) {
    // API 불가 — 로컬 캐시 유지
  } else if (remote.length > 0) {
    store.replaceAllMasses(remote)
  } else if (!store.hasPersistedMasses()) {
    store.replaceAllMasses([])
  }
  // 서버가 비어 있고 로컬만 있으면 로컬 유지 → /manage에서 「이 기기 → 서버」

  createApp(App).use(router).mount('#app')
}

void boot()
