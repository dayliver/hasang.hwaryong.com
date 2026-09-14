import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'
import EditorView from '../views/EditorView.vue'
import PresenterView from '../views/PresenterView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'present-home',
      component: PresenterView,
      meta: { title: '슬라이드쇼', chrome: false },
    },
    {
      path: '/manage',
      name: 'manage',
      component: HomeView,
      meta: { title: '관리' },
    },
    {
      path: '/edit/:id',
      name: 'edit',
      component: EditorView,
      meta: { title: '슬라이드 편집' },
    },
    {
      path: '/present/:id',
      name: 'present',
      component: PresenterView,
      meta: { title: '슬라이드쇼', chrome: false },
    },
  ],
})

router.afterEach((to) => {
  const base = '성정하상바울로성당'
  document.title = to.meta.title ? `${to.meta.title} · ${base}` : base
})

export default router
