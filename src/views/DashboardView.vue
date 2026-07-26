<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import { useAuthStore } from '../stores/auth'
import type { CreatedMonitorSession, MonitorSession } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const deviceName = ref('我的 Mac')
const current = ref<MonitorSession | null>(null)
const created = ref<CreatedMonitorSession | null>(null)
const busy = ref(false)
const error = ref('')
const copied = ref(false)

onMounted(async () => {
  if (!(await auth.restore())) {
    await router.replace('/login')
    return
  }
  try {
    const response = await apiRequest<{ session: MonitorSession | null }>('/api/monitor/sessions/current')
    current.value = response.session
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '无法读取监控会话'
  }
})

async function createSession() {
  busy.value = true
  error.value = ''
  copied.value = false
  try {
    created.value = await apiRequest<CreatedMonitorSession>('/api/monitor/sessions', {
      method: 'POST',
      body: JSON.stringify({ name: deviceName.value }),
    })
    current.value = created.value
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '创建失败'
  } finally {
    busy.value = false
  }
}

async function copyLink() {
  if (!created.value) return
  await navigator.clipboard.writeText(created.value.previewURL)
  copied.value = true
}

function logout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-row"><span class="mini-mark">A</span><strong>AutoBuff Monitor</strong></div>
      <div class="user-row"><span>{{ auth.user?.username }}</span><button class="text-button" @click="logout">退出</button></div>
    </header>

    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">REMOTE MONITOR</p>
        <h1>远程纯标注监控</h1>
        <p>在 AutoBuff 中登录后创建会话，软件会自动获得发布地址和预览链接。</p>
      </div>
      <div class="security-note"><span class="status-dot online"></span> 当前开放注册</div>
    </section>

    <section class="dashboard-grid">
      <article class="panel session-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">MONITOR SESSION</p><h2>创建新的监控会话</h2></div>
          <span v-if="current" class="tag">已有会话</span>
        </div>
        <p class="muted">每次创建都会撤销之前的预览链接，防止旧链接继续访问。</p>
        <label>
          设备名称
          <input v-model.trim="deviceName" maxlength="64" placeholder="例如：家里的 Mac" />
        </label>
        <p v-if="error" class="form-error">{{ error }}</p>
        <button class="primary-button" :disabled="busy" @click="createSession">
          {{ busy ? '正在生成…' : '生成预览链接' }}
        </button>
      </article>

      <article class="panel result-panel">
        <template v-if="created">
          <div class="link-icon">↗</div>
          <p class="eyebrow">PREVIEW READY</p>
          <h2>预览链接已生成</h2>
          <p class="link-box">{{ created.previewURL }}</p>
          <div class="button-row">
            <button class="primary-button" @click="copyLink">{{ copied ? '已复制' : '复制链接' }}</button>
            <a class="secondary-button" :href="created.previewURL" target="_blank">打开预览</a>
          </div>
          <p class="muted small">该链接相当于查看密码，请勿公开分享。</p>
        </template>
        <template v-else>
          <div class="empty-orbit"><span></span></div>
          <h2>等待创建</h2>
          <p class="muted">生成后，这里会显示专属预览链接。</p>
        </template>
      </article>
    </section>
  </main>
</template>
