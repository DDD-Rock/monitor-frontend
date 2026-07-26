<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import AnnotationStage from '../components/AnnotationStage.vue'
import type { Envelope, FramePayload, MapPayload, Snapshot, StatusPayload } from '../types/protocol'

const route = useRoute()
const token = String(route.params.token || '')
const map = ref<MapPayload | null>(null)
const frame = ref<FramePayload | null>(null)
const online = ref(false)
const status = ref('正在连接监控服务…')
const connected = ref(false)
const reconnectAttempt = ref(0)
let socket: WebSocket | null = null
let reconnectTimer: number | null = null

const playerText = computed(() => frame.value?.player ? `X ${(frame.value.player.x * 100).toFixed(1)} · Y ${(frame.value.player.y * 100).toFixed(1)}` : 'X -- · Y --')

function connect() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  socket = new WebSocket(`${protocol}//${location.host}/ws/view?token=${encodeURIComponent(token)}`)
  socket.onopen = () => {
    connected.value = true
    reconnectAttempt.value = 0
    status.value = '已连接，等待本机监控数据'
  }
  socket.onmessage = (event) => applyMessage(JSON.parse(event.data))
  socket.onerror = () => { status.value = '连接发生错误' }
  socket.onclose = () => {
    connected.value = false
    online.value = false
    scheduleReconnect()
  }
}

function applyMessage(message: Snapshot | Envelope) {
  if (message.type === 'snapshot') {
    online.value = message.online
    if (message.map) map.value = message.map
    if (message.frame) frame.value = message.frame
    if (message.status) status.value = message.status.message
    else status.value = message.online ? '本机监控在线' : '本机监控离线'
    return
  }
  if (message.type === 'map') map.value = message.payload as MapPayload
  if (message.type === 'frame') frame.value = message.payload as FramePayload
  if (message.type === 'status') {
    const payload = message.payload as StatusPayload
    online.value = payload.online
    status.value = payload.message
  }
}

function scheduleReconnect() {
  if (reconnectTimer !== null) return
  const delay = Math.min(15000, 1000 * 2 ** reconnectAttempt.value++)
  status.value = `连接已断开，${Math.round(delay / 1000)} 秒后重试`
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

onMounted(connect)
onBeforeUnmount(() => {
  if (reconnectTimer !== null) clearTimeout(reconnectTimer)
  socket?.close()
})
</script>

<template>
  <main class="preview-shell">
    <header class="preview-header">
      <div><p class="eyebrow">LIVE ANNOTATION</p><h1>{{ map?.name || 'AutoBuff 远程监控' }}</h1></div>
      <div class="live-state" :class="{ active: online }"><span></span>{{ online ? '本机在线' : connected ? '本机离线' : '正在重连' }}</div>
    </header>

    <section class="stage-frame">
      <AnnotationStage :map="map" :frame="frame" />
      <div v-if="!map && !frame" class="stage-empty"><div class="empty-orbit"><span></span></div><strong>等待标注数据</strong><p>请在本机 AutoBuff 中开始监控</p></div>
    </section>

    <footer class="telemetry-bar">
      <div><span>状态</span><strong>{{ status }}</strong></div>
      <div><span>玩家位置</span><strong class="mono">{{ playerText }}</strong></div>
      <div><span>队友</span><strong>{{ frame?.teammates.length || 0 }}</strong></div>
      <div><span>其他玩家</span><strong>{{ frame?.others.length || 0 }}</strong></div>
      <div><span>本机帧率</span><strong class="mono">{{ frame ? `${frame.sourceFPS.toFixed(1)} FPS` : '-- FPS' }}</strong></div>
    </footer>
  </main>
</template>
