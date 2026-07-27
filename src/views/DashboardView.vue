<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import { useAuthStore } from '../stores/auth'
import type { BarkSettings, CreatedMonitorSession, MonitorSession } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const deviceName = ref('我的 Mac')
const current = ref<MonitorSession | null>(null)
const created = ref<CreatedMonitorSession | null>(null)
const busy = ref(false)
const error = ref('')
const copied = ref(false)
const barkSettings = ref<BarkSettings | null>(null)
const barkDeviceKey = ref('')
const barkBusy = ref(false)
const barkMessage = ref('')
const barkError = ref('')

onMounted(async () => {
  if (!(await auth.restore())) {
    await router.replace('/login')
    return
  }
  try {
    const [sessionResponse, notificationResponse] = await Promise.all([
      apiRequest<{ session: MonitorSession | null }>('/api/monitor/sessions/current'),
      apiRequest<BarkSettings>('/api/notifications/bark'),
    ])
    current.value = sessionResponse.session
    barkSettings.value = notificationResponse
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

async function saveBark() {
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/bark', {
      method: 'PUT',
      body: JSON.stringify({
        deviceKey: barkDeviceKey.value,
      }),
    })
    barkDeviceKey.value = ''
    barkMessage.value = 'Bark 配置已保存'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : 'Bark 配置保存失败'
  } finally {
    barkBusy.value = false
  }
}

async function testBark() {
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    await apiRequest('/api/notifications/bark/test', { method: 'POST' })
    barkMessage.value = '测试通知已发送'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '测试通知发送失败'
  } finally {
    barkBusy.value = false
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

      <article class="panel bark-settings-panel">
        <div class="panel-heading">
          <div><p class="eyebrow">IPHONE PUSH</p><h2>Bark 通知</h2></div>
          <span class="tag" :class="{ configured: barkSettings?.configured }">{{ barkSettings?.configured ? '已配置' : '未配置' }}</span>
        </div>
        <p class="muted">先在 iPhone Bark 中添加自建服务器，再把生成的 DeviceKey 填到这里。</p>
        <p class="bark-server-box"><span>服务器地址</span><strong class="mono">{{ barkSettings?.barkServerURL || '正在读取…' }}</strong></p>
        <label>
          Bark DeviceKey
          <input v-model.trim="barkDeviceKey" maxlength="128" :placeholder="barkSettings?.configured ? '已安全保存；重新填写可替换' : '请输入 Bark 生成的 DeviceKey'" />
        </label>
        <p class="device-key-hint">填写 Bark 首页“推送地址”的最后一段，不要填写 64 位 APNs DeviceToken。</p>
        <p class="device-key-hint">保存后，在预览页按需开启各类推送规则。</p>
        <p v-if="barkError" class="form-error">{{ barkError }}</p>
        <p v-if="barkMessage" class="form-success">{{ barkMessage }}</p>
        <div class="button-row">
          <button class="primary-button" :disabled="barkBusy || !barkDeviceKey" @click="saveBark">{{ barkBusy ? '处理中…' : '保存配置' }}</button>
          <button class="secondary-button" :disabled="barkBusy || !barkSettings?.configured" @click="testBark">发送测试</button>
        </div>
      </article>
    </section>
  </main>
</template>
