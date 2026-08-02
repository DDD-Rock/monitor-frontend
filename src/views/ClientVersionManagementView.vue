<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import BackButton from '../components/BackButton.vue'
import LogoMark from '../components/LogoMark.vue'
import { useAuthStore } from '../stores/auth'
import type { ClientVersionPolicy } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const versions = ref<ClientVersionPolicy[]>([])
const loading = ref(true)
const error = ref('')
const message = ref('')
const platform = ref<'macos' | 'windows'>('macos')
const version = ref('')
const enabled = ref(true)
const savingKey = ref('')
const platforms: ClientVersionPolicy['platform'][] = ['macos', 'windows']

const groupedVersions = computed(() => ({
  macos: versions.value.filter((item) => item.platform === 'macos'),
  windows: versions.value.filter((item) => item.platform === 'windows'),
}))

function keyOf(item: Pick<ClientVersionPolicy, 'platform' | 'version'>) {
  return `${item.platform}:${item.version}`
}

function platformName(value: ClientVersionPolicy['platform']) {
  return value === 'macos' ? 'macOS' : 'Windows'
}

async function load() {
  const response = await apiRequest<{ versions: ClientVersionPolicy[] }>('/api/admin/client-versions')
  versions.value = response.versions
}

async function savePolicy(payload: Pick<ClientVersionPolicy, 'platform' | 'version' | 'enabled'>) {
  const key = keyOf(payload)
  savingKey.value = key
  error.value = ''
  message.value = ''
  try {
    await apiRequest('/api/admin/client-versions', {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    await load()
    message.value = `${platformName(payload.platform)} ${payload.version} 已${payload.enabled ? '启用' : '禁用'}。`
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '版本策略保存失败'
  } finally {
    savingKey.value = ''
  }
}

async function addVersion() {
  const normalized = version.value.trim()
  if (!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,31}$/.test(normalized)) {
    error.value = '版本号须为 1–32 位，只能包含字母、数字、点、下划线、加号或减号'
    return
  }
  await savePolicy({ platform: platform.value, version: normalized, enabled: enabled.value })
  if (!error.value) version.value = ''
}

async function toggle(item: ClientVersionPolicy) {
  const action = item.enabled ? '禁用' : '启用'
  if (!confirm(`确定要${action} ${platformName(item.platform)} ${item.version} 吗？${item.enabled ? '禁用后该版本将无法登录。' : ''}`)) return
  await savePolicy({ platform: item.platform, version: item.version, enabled: !item.enabled })
}

onMounted(async () => {
  if (!(await auth.restore())) return router.replace('/login')
  if (!auth.user?.isSuperAdmin) return router.replace('/functions')
  try {
    await load()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '客户端版本加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="portal-shell">
    <header class="portal-topbar">
      <div class="portal-topbar-start"><BackButton /><RouterLink class="portal-logo" to="/functions"><LogoMark />AutoBuff</RouterLink></div>
      <nav><RouterLink to="/functions">功能中心</RouterLink><RouterLink to="/manual">使用手册</RouterLink><RouterLink to="/admin/users">用户管理</RouterLink><RouterLink to="/admin/maps">地图管理</RouterLink><strong>客户端版本</strong></nav>
    </header>

    <section class="portal-content manage-content">
      <div class="manage-heading">
        <div><p class="portal-kicker">CLIENT RELEASES</p><h1>客户端版本管理</h1><p>禁用版本后，使用该版本的桌面客户端会被拒绝登录，并提示更新客户端。</p></div>
      </div>

      <form class="version-policy-form" @submit.prevent="addVersion">
        <label>平台<select v-model="platform"><option value="macos">macOS</option><option value="windows">Windows</option></select></label>
        <label>版本号<input v-model="version" maxlength="32" placeholder="例如 2.0.1"></label>
        <label>初始状态<select v-model="enabled"><option :value="true">启用</option><option :value="false">禁用</option></select></label>
        <button :disabled="!version.trim() || !!savingKey" type="submit">保存版本策略</button>
      </form>

      <p v-if="error" class="inline-notice">{{ error }}</p>
      <p v-if="message" class="inline-success">{{ message }}</p>
      <div v-if="loading" class="empty-portal"><span>⇧</span><p>正在读取客户端版本…</p></div>

      <template v-else>
        <section v-for="currentPlatform in platforms" :key="currentPlatform" class="version-platform-section">
          <h2>{{ platformName(currentPlatform) }}</h2>
          <div v-if="groupedVersions[currentPlatform].length" class="user-table-wrap">
            <table class="user-table">
              <thead><tr><th>版本</th><th>状态</th><th>首次登记</th><th>最近修改</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="item in groupedVersions[currentPlatform]" :key="keyOf(item)">
                  <td><strong>v{{ item.version }}</strong></td>
                  <td><span class="status-badge" :class="{ disabled: !item.enabled }">{{ item.enabled ? '允许登录' : '已禁用' }}</span></td>
                  <td>{{ new Date(item.createdAt).toLocaleString('zh-CN') }}</td>
                  <td>{{ new Date(item.updatedAt).toLocaleString('zh-CN') }}</td>
                  <td class="table-actions"><button :disabled="savingKey === keyOf(item)" :class="{ danger: item.enabled }" @click="toggle(item)">{{ item.enabled ? '禁用' : '启用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="version-empty">尚未登记 {{ platformName(currentPlatform) }} 客户端版本。客户端首次登录后会自动出现。</div>
        </section>
      </template>
    </section>
  </main>
</template>
