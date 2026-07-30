<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const auth = useAuthStore()
const router = useRouter()

onMounted(async () => {
  if (!(await auth.restore())) await router.replace('/login')
})

function logout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <main class="portal-shell">
    <header class="portal-topbar">
      <RouterLink class="portal-logo" to="/functions"><span>A</span>AutoBuff</RouterLink>
      <div class="portal-account">
        <span>{{ auth.user?.username }}</span>
        <em v-if="auth.user?.isSuperAdmin">超级管理员</em>
        <button @click="logout">退出</button>
      </div>
    </header>

    <section class="portal-content">
      <p class="portal-kicker">WORKSPACE</p>
      <h1>今天想做什么？</h1>
      <p class="portal-lead">所有远程工具都集中在这里，后续的新功能也会从这里进入。</p>

      <div class="feature-grid">
        <RouterLink class="feature-card feature-monitor" to="/dashboard">
          <span class="feature-icon">⌁</span>
          <div><small>实时状态</small><h2>远程监控</h2><p>查看地图标注、角色位置、经验与告警状态。</p></div>
          <b>进入 →</b>
        </RouterLink>
        <RouterLink class="feature-card feature-clients" to="/clients">
          <span class="feature-icon">⌘</span>
          <div><small>设备中心</small><h2>客户端管理</h2><p>识别每台已登录客户端，查看模式并远程开始或停止。</p></div>
          <b>管理 →</b>
        </RouterLink>
        <RouterLink v-if="auth.user?.isSuperAdmin" class="feature-card feature-admin" to="/admin/users">
          <span class="feature-icon">♙</span>
          <div><small>仅超级管理员</small><h2>用户管理</h2><p>查看全部账号、调整封禁状态或重置用户密码。</p></div>
          <b>管理 →</b>
        </RouterLink>
      </div>
    </section>
  </main>
</template>
