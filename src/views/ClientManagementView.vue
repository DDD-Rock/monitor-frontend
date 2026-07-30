<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { getAccessToken } from '../api/client'
import { useAuthStore } from '../stores/auth'
import type { ManagedClient } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const clients = ref<ManagedClient[]>([])
const connected = ref(false)
const error = ref('')
const pending = ref(new Set<string>())
let socket: WebSocket | null = null
let reconnectTimer: number | null = null

const onlineCount = computed(() => clients.value.filter((item) => item.online).length)
const modeNames: Record<ManagedClient['mode'], string> = {
  dead: '死花模式',
  live: '活花模式',
  follow_heal: '跟补模式',
  monitor: '监控模式',
}

function connect() {
  const token = getAccessToken()
  if (!token) return
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${protocol}//${location.host}/ws/clients?access_token=${encodeURIComponent(token)}`)
  socket.onopen = () => { connected.value = true; error.value = '' }
  socket.onmessage = (event) => {
    const message = JSON.parse(event.data) as { type: string; clients?: ManagedClient[] }
    if (message.type === 'clients' && message.clients) {
      clients.value = message.clients
      pending.value = new Set()
    }
  }
  socket.onerror = () => { error.value = '实时连接暂时不可用，正在重试…' }
  socket.onclose = () => {
    connected.value = false
    reconnectTimer = window.setTimeout(connect, 2000)
  }
}

function control(client: ManagedClient) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !client.online) return
  pending.value = new Set(pending.value).add(client.clientId)
  socket.send(JSON.stringify({
    type: 'command',
    clientId: client.clientId,
    action: client.running ? 'stop' : 'start',
  }))
}

function formatLastSeen(value: number | null) {
  return value ? new Date(value).toLocaleString('zh-CN') : '尚无连接记录'
}

onMounted(async () => {
  if (!(await auth.restore())) {
    await router.replace('/login')
    return
  }
  connect()
})

onBeforeUnmount(() => {
  if (reconnectTimer !== null) clearTimeout(reconnectTimer)
  socket?.close()
})
</script>

<template>
  <main class="portal-shell">
    <header class="portal-topbar">
      <RouterLink class="portal-logo" to="/functions"><span>A</span>AutoBuff</RouterLink>
      <nav><RouterLink to="/functions">功能中心</RouterLink><strong>客户端管理</strong></nav>
    </header>
    <section class="portal-content manage-content">
      <div class="manage-heading">
        <div><p class="portal-kicker">CLIENTS</p><h1>客户端管理</h1><p>每台设备都有一个独一无二的名字，客户端界面会显示同一个名字。</p></div>
        <span class="live-summary" :class="{ active: connected }">{{ onlineCount }} 台在线</span>
      </div>
      <p v-if="error" class="inline-notice">{{ error }}</p>
      <div v-if="clients.length" class="client-grid">
        <article v-for="client in clients" :key="client.id" class="client-card">
          <div class="client-card-head">
            <span class="device-orb" :class="{ online: client.online }">⌘</span>
            <div><h2>{{ client.name }}</h2><p>{{ client.online ? '实时连接中' : `最后连接：${formatLastSeen(client.lastSeenAt)}` }}</p></div>
            <i :class="{ online: client.online }"></i>
          </div>
          <dl><div><dt>当前模式</dt><dd>{{ modeNames[client.mode] }}</dd></div><div><dt>运行状态</dt><dd :class="{ running: client.running }">{{ client.running ? '运行中' : '已停止' }}</dd></div></dl>
          <div class="client-actions">
            <RouterLink :to="{ path: '/dashboard', query: { client: client.clientId } }">查看监控</RouterLink>
            <button :class="{ stop: client.running }" :disabled="!client.online || pending.has(client.clientId)" @click="control(client)">
              {{ pending.has(client.clientId) ? '等待客户端…' : client.running ? '停止' : '开始' }}
            </button>
          </div>
        </article>
      </div>
      <section v-else class="empty-portal"><span>⌘</span><h2>还没有客户端</h2><p>请先在 AutoBuff 客户端登录当前账号，连接后会自动出现在这里。</p></section>
    </section>
  </main>
</template>
