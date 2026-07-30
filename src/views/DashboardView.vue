<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import { useAuthStore } from '../stores/auth'
import type { BarkSettings } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
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
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/bark')
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '无法读取通知设置'
  }
})

async function saveBark() {
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/bark', {
      method: 'PUT',
      body: JSON.stringify({ deviceKey: barkDeviceKey.value }),
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

function logout() {
  auth.logout()
  router.replace('/login')
}
</script>

<template>
  <main class="app-shell">
    <header class="topbar">
      <div class="brand-row"><span class="mini-mark">A</span><strong>AutoBuff Monitor</strong></div>
      <div class="user-row">
        <span>{{ auth.user?.username }}</span>
        <RouterLink class="text-button" to="/functions">功能中心</RouterLink>
        <RouterLink class="text-button" to="/dashboard">返回监控</RouterLink>
        <button class="text-button" @click="logout">退出</button>
      </div>
    </header>

    <section class="dashboard-hero">
      <div>
        <p class="eyebrow">ACCOUNT SETTINGS</p>
        <h1>账号设置</h1>
        <p>客户端和网页使用同一账号登录，不需要创建会话或保存预览 Key。</p>
      </div>
      <div class="security-note"><span class="status-dot online"></span> 已通过账号鉴权</div>
    </section>

    <section class="dashboard-grid">
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
