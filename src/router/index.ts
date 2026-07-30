import { createRouter, createWebHistory } from 'vue-router'
import { getAccessToken } from '../api/client'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/functions' },
    { path: '/login', component: () => import('../views/AuthView.vue'), props: { mode: 'login' } },
    { path: '/register', component: () => import('../views/AuthView.vue'), props: { mode: 'register' } },
    { path: '/functions', component: () => import('../views/FunctionListView.vue'), meta: { requiresAuth: true } },
    { path: '/clients', component: () => import('../views/ClientManagementView.vue'), meta: { requiresAuth: true } },
    { path: '/admin/users', component: () => import('../views/UserManagementView.vue'), meta: { requiresAuth: true } },
    { path: '/dashboard', component: () => import('../views/PreviewView.vue'), meta: { requiresAuth: true } },
    { path: '/dashboard/minimal', component: () => import('../views/PreviewView.vue'), meta: { requiresAuth: true, minimal: true } },
    { path: '/settings', component: () => import('../views/DashboardView.vue'), meta: { requiresAuth: true } },
    { path: '/preview/:pathMatch(.*)*', redirect: '/functions' },
  ],
})

router.beforeEach((to) => {
  if (to.meta.requiresAuth && !getAccessToken()) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
})

export default router
