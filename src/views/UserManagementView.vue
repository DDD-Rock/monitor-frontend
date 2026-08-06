<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import BackButton from '../components/BackButton.vue'
import LogoMark from '../components/LogoMark.vue'
import { useAuthStore } from '../stores/auth'
import type { AdminUser, ManagedClient } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const users = ref<AdminUser[]>([])
const error = ref('')
const busyID = ref<number | null>(null)
const clientDialog = ref<HTMLDialogElement | null>(null)
const selectedUser = ref<AdminUser | null>(null)
const clients = ref<ManagedClient[]>([])
const maxClientCount = ref(2)
const dialogLoading = ref(false)
const dialogError = ref('')
const busyClientID = ref<string | null>(null)
const modeDraft = ref<ManagedClient['mode'][]>([])
const savingModes = ref(false)
const selectedClientIDs = ref<Set<string>>(new Set())
const kickingClients = ref(false)
const modeOptions: { value: ManagedClient['mode']; label: string }[] = [
  { value: 'dead', label: '死花模式' }, { value: 'live', label: '活花模式' },
  { value: 'temple', label: '神殿模式' }, { value: 'follow_heal', label: '跟补模式' },
  { value: 'monitor', label: '监控模式' },
]
const onlineClients = computed(() => clients.value.filter((client) => client.online))
const allOnlineSelected = computed(() => onlineClients.value.length > 0 && onlineClients.value.every((client) => selectedClientIDs.value.has(client.id)))

async function load() {
  const response = await apiRequest<{ users: AdminUser[] }>('/api/admin/users')
  users.value = response.users
}

async function toggleStatus(user: AdminUser) {
  if (!confirm(`确定要${user.status ? '封禁' : '解封'}用户“${user.nickname}”吗？`)) return
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
  const password = prompt(`为“${user.nickname}”设置新密码（8–72 位）：`)
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

async function loadUserClients(user: AdminUser) {
  const response = await apiRequest<{ clients: ManagedClient[]; maxClientCount: number }>(
    `/api/admin/users/${user.id}/clients`,
  )
  clients.value = response.clients
  maxClientCount.value = response.maxClientCount
}

async function openClientDialog(user: AdminUser) {
  selectedUser.value = user
  modeDraft.value = [...user.authorizedModes]
  selectedClientIDs.value = new Set()
  clients.value = []
  maxClientCount.value = user.maxClientCount
  dialogError.value = ''
  clientDialog.value?.showModal()
  dialogLoading.value = true
  try {
    await loadUserClients(user)
  } catch (caught) {
    dialogError.value = caught instanceof Error ? caught.message : '客户端加载失败'
  } finally {
    dialogLoading.value = false
  }
}

async function saveAuthorizedModes() {
  const user = selectedUser.value
  if (!user || user.isSuperAdmin) return
  savingModes.value = true
  try {
    await apiRequest(`/api/admin/users/${user.id}/authorized-modes`, {
      method: 'PUT', body: JSON.stringify({ modes: modeDraft.value }),
    })
    await load()
    selectedUser.value = users.value.find((item) => item.id === user.id) ?? user
    dialogError.value = ''
  } catch (caught) {
    dialogError.value = caught instanceof Error ? caught.message : '授权保存失败'
  } finally { savingModes.value = false }
}

function toggleMode(mode: ManagedClient['mode']) {
  modeDraft.value = modeDraft.value.includes(mode)
    ? modeDraft.value.filter((item) => item !== mode)
    : [...modeDraft.value, mode]
}

function toggleClient(clientID: string) {
  const next = new Set(selectedClientIDs.value)
  next.has(clientID) ? next.delete(clientID) : next.add(clientID)
  selectedClientIDs.value = next
}

function toggleAllOnline() {
  selectedClientIDs.value = allOnlineSelected.value
    ? new Set()
    : new Set(onlineClients.value.map((client) => client.id))
}

async function kickSelectedClients() {
  const user = selectedUser.value
  const sessionIds = [...selectedClientIDs.value]
  if (!user || !sessionIds.length || !confirm(`确定将选中的 ${sessionIds.length} 台客户端踢下线吗？`)) return
  kickingClients.value = true
  try {
    const response = await apiRequest<{ kickedCount: number }>(`/api/admin/users/${user.id}/clients/kick`, {
      method: 'POST', body: JSON.stringify({ sessionIds }),
    })
    selectedClientIDs.value = new Set()
    await Promise.all([loadUserClients(user), load()])
    dialogError.value = response.kickedCount ? `已将 ${response.kickedCount} 台客户端踢下线。` : '所选客户端当前均不在线。'
  } catch (caught) {
    dialogError.value = caught instanceof Error ? caught.message : '踢下线失败'
  } finally { kickingClients.value = false }
}

async function saveClientLimit() {
  const user = selectedUser.value
  if (!user) return
  if (!Number.isInteger(maxClientCount.value) || maxClientCount.value < 0 || maxClientCount.value > 100) {
    dialogError.value = '客户端上限必须是 0 到 100 之间的整数'
    return
  }
  busyID.value = user.id
  try {
    await apiRequest(`/api/admin/users/${user.id}/client-limit`, {
      method: 'PATCH',
      body: JSON.stringify({ maxClientCount: maxClientCount.value }),
    })
    dialogError.value = ''
    await load()
    selectedUser.value = users.value.find((item) => item.id === user.id) ?? user
  } catch (caught) {
    dialogError.value = caught instanceof Error ? caught.message : '额度保存失败'
  } finally {
    busyID.value = null
  }
}

async function unbindClient(client: ManagedClient) {
  const user = selectedUser.value
  if (!user || !confirm(`确定要解绑“${client.name}”吗？该电脑下次连接时会重新占用一个名额。`)) return
  busyClientID.value = client.id
  try {
    await apiRequest(`/api/admin/users/${user.id}/clients/${client.id}`, { method: 'DELETE' })
    dialogError.value = ''
    await Promise.all([loadUserClients(user), load()])
  } catch (caught) {
    dialogError.value = caught instanceof Error ? caught.message : '解绑失败'
  } finally {
    busyClientID.value = null
  }
}

function formatDate(value: number | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '从未连接'
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
      <div class="portal-topbar-start"><BackButton /><RouterLink class="portal-logo" to="/functions"><LogoMark />AutoBuff</RouterLink></div>
      <nav><RouterLink to="/functions">功能中心</RouterLink><RouterLink to="/manual">使用手册</RouterLink><strong>用户管理</strong></nav>
    </header>
    <section class="portal-content manage-content">
      <div class="manage-heading"><div><p class="portal-kicker">ADMIN</p><h1>用户管理</h1></div></div>
      <p v-if="error" class="inline-notice">{{ error }}</p>
      <div class="user-table-wrap">
        <table class="user-table">
          <thead><tr><th>用户</th><th>身份</th><th>状态</th><th>客户端</th><th>最近登录</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="user in users" :key="user.id">
              <td><strong>{{ user.nickname }}</strong><small>#{{ user.id }}</small></td>
              <td><span v-if="user.isSuperAdmin" class="admin-badge">超级管理员</span><span v-else>普通用户</span></td>
              <td><span class="status-badge" :class="{ disabled: !user.status }">{{ user.status ? '正常' : '已封禁' }}</span></td>
              <td>{{ user.connectedClientCount }} / {{ user.maxClientCount }}</td>
              <td>{{ user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString('zh-CN') : '从未登录' }}</td>
              <td class="table-actions">
                <button :disabled="busyID === user.id" @click="openClientDialog(user)">客户端</button>
                <button :disabled="busyID === user.id" @click="resetPassword(user)">改密码</button>
                <button :disabled="busyID === user.id || user.id === auth.user?.id" :class="{ danger: user.status }" @click="toggleStatus(user)">{{ user.status ? '封禁' : '解封' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dialog ref="clientDialog" class="client-admin-dialog" @close="selectedUser = null">
      <header>
        <div>
          <p class="portal-kicker">CLIENT ACCESS</p>
          <h2>{{ selectedUser?.nickname }} 的客户端</h2>
        </div>
        <button class="dialog-close" aria-label="关闭" @click="clientDialog?.close()">×</button>
      </header>

      <p class="dialog-help">一台电脑首次连接时占用一个名额；更新软件版本不会新增电脑。</p>
      <p v-if="dialogError" class="inline-notice">{{ dialogError }}</p>

      <section class="mode-authorization">
        <div><strong>模式授权</strong><small>{{ selectedUser?.isSuperAdmin ? '超级管理员始终拥有全部模式' : '客户端下次登录时刷新' }}</small></div>
        <label v-for="option in modeOptions" :key="option.value">
          <input :checked="modeDraft.includes(option.value)" :disabled="selectedUser?.isSuperAdmin || savingModes" type="checkbox" @change="toggleMode(option.value)">
          <span>{{ option.label }}</span>
        </label>
        <button :disabled="selectedUser?.isSuperAdmin || savingModes" @click="saveAuthorizedModes">{{ savingModes ? '保存中…' : '保存授权' }}</button>
      </section>

      <form class="client-limit-form" @submit.prevent="saveClientLimit">
        <label for="max-client-count">最多绑定客户端数</label>
        <input id="max-client-count" v-model.number="maxClientCount" type="number" min="0" max="100" step="1">
        <button :disabled="busyID === selectedUser?.id" type="submit">
          {{ busyID === selectedUser?.id ? '保存中…' : '保存额度' }}
        </button>
      </form>
      <p class="limit-tip">额度低于当前已绑定数量时，已有电脑不受影响，但无法再绑定新电脑。</p>

      <div v-if="dialogLoading" class="dialog-state">正在加载客户端…</div>
      <div v-else-if="clients.length" class="admin-client-list">
        <div class="kick-toolbar">
          <label><input :checked="allOnlineSelected" :disabled="!onlineClients.length" type="checkbox" @change="toggleAllOnline">全选在线客户端</label>
          <button :disabled="!selectedClientIDs.size || kickingClients" @click="kickSelectedClients">{{ kickingClients ? '正在踢下线…' : `一键踢下线 (${selectedClientIDs.size})` }}</button>
        </div>
        <article v-for="client in clients" :key="client.id">
          <div class="admin-client-main">
            <input class="client-kick-checkbox" :checked="selectedClientIDs.has(client.id)" :disabled="!client.online || kickingClients" type="checkbox" :aria-label="`选择 ${client.name}`" @change="toggleClient(client.id)">
            <span class="client-online-dot" :class="{ online: client.online }"></span>
            <div>
              <strong>{{ client.name }}</strong>
              <small>{{ client.online ? '当前在线' : `最后连接：${formatDate(client.lastSeenAt)}` }}</small>
              <small>首次绑定：{{ formatDate(client.createdAt) }}</small>
              <code>{{ client.clientId }}</code>
            </div>
          </div>
          <button
            class="unbind-button"
            :disabled="busyClientID === client.id"
            @click="unbindClient(client)"
          >
            {{ busyClientID === client.id ? '解绑中…' : '解绑' }}
          </button>
        </article>
      </div>
      <div v-else class="dialog-state">该用户还没有绑定客户端。</div>
    </dialog>
  </main>
</template>
