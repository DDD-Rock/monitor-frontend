<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import { useAuthStore } from '../stores/auth'
import type { AdminUser } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const users = ref<AdminUser[]>([])
const error = ref('')
const busyID = ref<number | null>(null)

async function load() {
  const response = await apiRequest<{ users: AdminUser[] }>('/api/admin/users')
  users.value = response.users
}

async function toggleStatus(user: AdminUser) {
  if (!confirm(`确定要${user.status ? '封禁' : '解封'}用户“${user.username}”吗？`)) return
  busyID.value = user.id
  try {
    await apiRequest(`/api/admin/users/${user.id}/status`, {
      method: 'PATCH', body: JSON.stringify({ status: user.status ? 0 : 1 }),
    })
    await load()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '操作失败'
  } finally { busyID.value = null }
}

async function resetPassword(user: AdminUser) {
  const password = prompt(`为“${user.username}”设置新密码（8–72 位）：`)
  if (password === null) return
  if (password.length < 8 || password.length > 72) {
    error.value = '密码长度须为 8–72 位'
    return
  }
  busyID.value = user.id
  try {
    await apiRequest(`/api/admin/users/${user.id}/password`, {
      method: 'PUT', body: JSON.stringify({ password }),
    })
    error.value = ''
    alert('密码已修改')
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '操作失败'
  } finally { busyID.value = null }
}

onMounted(async () => {
  if (!(await auth.restore())) return router.replace('/login')
  if (!auth.user?.isSuperAdmin) return router.replace('/functions')
  try { await load() } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '加载失败'
  }
})
</script>

<template>
  <main class="portal-shell">
    <header class="portal-topbar">
      <RouterLink class="portal-logo" to="/functions"><span>A</span>AutoBuff</RouterLink>
      <nav><RouterLink to="/functions">功能中心</RouterLink><strong>用户管理</strong></nav>
    </header>
    <section class="portal-content manage-content">
      <div class="manage-heading"><div><p class="portal-kicker">ADMIN</p><h1>用户管理</h1><p>超级管理员权限本身不会在网页提供修改入口。</p></div></div>
      <p v-if="error" class="inline-notice">{{ error }}</p>
      <div class="user-table-wrap">
        <table class="user-table">
          <thead><tr><th>用户</th><th>身份</th><th>状态</th><th>客户端</th><th>最近登录</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td><strong>{{ user.username }}</strong><small>#{{ user.id }}</small></td>
              <td><span v-if="user.isSuperAdmin" class="admin-badge">超级管理员</span><span v-else>普通用户</span></td>
              <td><span class="status-badge" :class="{ disabled: !user.status }">{{ user.status ? '正常' : '已封禁' }}</span></td>
              <td>{{ user.connectedClientCount }}</td>
              <td>{{ user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '从未登录' }}</td>
              <td class="table-actions">
                <button :disabled="busyID === user.id" @click="resetPassword(user)">改密码</button>
                <button :disabled="busyID === user.id || user.id === auth.user?.id" :class="{ danger: user.status }" @click="toggleStatus(user)">{{ user.status ? '封禁' : '解封' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  </main>
</template>
