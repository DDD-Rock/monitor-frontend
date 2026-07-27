import { createRouter, createWebHistory } from 'vue-router'
import { getAccessToken } from '../api/client'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/dashboard' },
    { path: '/login', component: () => import('../views/AuthView.vue'), props: { mode: 'login' } },
    { path: '/register', component: () => import('../views/AuthView.vue'), props: { mode: 'register' } },
    { path: '/dashboard', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/preview/:token/minimal', component: () => import('../views/PreviewView.vue'), meta: { minimal: true } },
    { path: '/preview/:token', component: () => import('../views/PreviewView.vue') },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getAccessToken()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
