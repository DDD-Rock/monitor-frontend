<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { apiRequest } from '../api/client'
import AnnotationStage from '../components/AnnotationStage.vue'
import type { BarkSettings } from '../types/api'
import type { Envelope, EXPPayload, FramePayload, MapPayload, RunePayload, Snapshot, StatusPayload, ZonePayload } from '../types/protocol'

const route = useRoute()
const token = String(route.params.token || '')
const minimalMode = computed(() => route.meta.minimal === true)
const darkThemeKey = 'minimalDarkTheme'
const minimalDark = ref(readStoredDarkTheme())
const minimalPath = computed(() => `/preview/${encodeURIComponent(token)}/minimal`)
const map = ref<MapPayload | null>(null)
const frame = ref<FramePayload | null>(null)
const exp = ref<EXPPayload | null>(null)
const rune = ref<RunePayload | null>(null)
const zone = ref<ZonePayload | null>(null)
const online = ref(false)
const status = ref('正在连接监控服务…')
const connected = ref(false)
const reconnectAttempt = ref(0)
const barkSettings = ref<BarkSettings | null>(null)
const barkBusy = ref(false)
const barkMessage = ref('')
const barkError = ref('')
const expStalledSeconds = ref(120)
const cpuSamples = ref([18, 21, 19, 24, 27, 25, 31, 29, 33, 28, 26, 30, 34, 32, 29, 35, 31, 27])
// 真实数据：每 5 秒采一次 EXP，存的是这 5 秒的增量，伪装成磁盘写入速率。
const writeSampleCount = 18
const writeSampleSeconds = 5
const writeSamples = ref<number[]>(new Array(writeSampleCount).fill(0))
// 经验最后一次变化的时刻，用来在网页端自己判断是否停滞。
const expLastChangedAt = ref<number | null>(null)
// 供「已停滞多久」这类随时间变化的判断重新求值，由 CPU 定时器每 1.5 秒推一次。
const uiClock = ref(Date.now())
let socket: WebSocket | null = null
let reconnectTimer: number | null = null
let cpuTimer: number | null = null
let writeTimer: number | null = null
let lastSampledEXP: number | null = null
let defaultDocumentTitle = ''

const playerText = computed(() => frame.value?.player ? `X ${(frame.value.player.x * 100).toFixed(1)} · Y ${(frame.value.player.y * 100).toFixed(1)}` : 'X -- · Y --')
const expValueText = computed(() => exp.value?.currentEXP == null ? '--' : exp.value.currentEXP.toLocaleString('zh-CN'))
const diskUsageText = computed(() => exp.value?.currentEXP == null ? '--' : `${expValueText.value} MB`)
const expPercentText = computed(() => exp.value?.percent == null ? '--%' : `${formatPercent(exp.value.percent)}%`)
const expConfidenceText = computed(() => exp.value?.confidence == null ? '--' : `${Math.round(exp.value.confidence * 100)}%`)
const cpuUsageText = computed(() => `${cpuSamples.value.at(-1) || 0}%`)
const cpuLoadText = computed(() => (((cpuSamples.value.at(-1) || 0) / 100) * 1.6).toFixed(2))
const cpuPoints = computed(() => cpuSamples.value.map((value, index) => {
  const x = index * 260 / (cpuSamples.value.length - 1)
  const y = 54 - value * 0.5
  return `${x.toFixed(1)},${y.toFixed(1)}`
}).join(' '))
const writeRateText = computed(
  () => `${((writeSamples.value.at(-1) || 0) / writeSampleSeconds).toFixed(1)} MB/s`,
)
const writeAverageText = computed(() => {
  const total = writeSamples.value.reduce((sum, value) => sum + value, 0)
  const seconds = writeSamples.value.length * writeSampleSeconds
  return `${(total / seconds).toFixed(1)} MB/s`
})
// 经验增量没有固定上限，按窗口内峰值自动缩放；下限取 1 让空闲时是一条底部直线。
const writePeak = computed(() => Math.max(1, ...writeSamples.value))
const writePoints = computed(() => writeSamples.value.map((value, index) => {
  const x = index * 260 / (writeSamples.value.length - 1)
  const y = 54 - (value / writePeak.value) * 50
  return `${x.toFixed(1)},${y.toFixed(1)}`
}).join(' '))
const channelStatusText = computed(() => {
  if (!connected.value) return status.value
  return online.value ? '监控通道已建立' : '监控通道已建立，等待本机上线'
})
// 本机离线时最后一次上报不再代表现状，此时不显示「符文提示中」。
const runeActive = computed(() => online.value && rune.value?.detected === true)
const runeStatusText = computed(() => {
  if (!online.value) return '等待本机上线'
  return runeActive.value ? '画面出现符文提示，请尽快解除' : '未出现符文提示'
})
const runeConfidenceText = computed(() =>
  runeActive.value && rune.value?.confidence != null
    ? `${Math.round(rune.value.confidence * 100)}%`
    : '--',
)
// rect 为空表示本机没有配置安全区，此时既不画框也不报警。
const zoneRect = computed(() => zone.value?.rect ?? null)
const zoneConfigured = computed(() => zoneRect.value !== null)
const zoneOutside = computed(() => online.value && zone.value?.outside === true)
const zoneStatusText = computed(() => {
  if (!zoneConfigured.value) return '本机未设置安全区'
  if (!online.value) return '等待本机上线'
  return zoneOutside.value ? '角色已离开安全区' : '角色在安全区内'
})
const zoneSizeText = computed(() => {
  const rect = zoneRect.value
  if (!rect) return '--'
  return `${Math.round(rect.width * 100)}% × ${Math.round(rect.height * 100)}%`
})
// 服务端在读不到经验时会清掉停滞计时而不是判定停滞，这里保持一致。
const expStalledActive = computed(() => {
  if (!online.value || exp.value?.currentEXP == null) return false
  const changedAt = expLastChangedAt.value
  if (changedAt === null) return false
  const thresholdMS = (barkSettings.value?.expStalledSeconds ?? 120) * 1000
  return uiClock.value - changedAt >= thresholdMS
})
const expStalledStatusText = computed(() => {
  if (!online.value) return '等待节点上线'
  if (exp.value?.currentEXP == null) return '等待读数'
  return expStalledActive.value ? '已停滞' : '正常'
})

// 只在经验数值真的变化时重置计时；同一个读数反复上报不算变化。
watch(
  () => exp.value?.currentEXP ?? null,
  (current, previous) => {
    if (current === null) {
      expLastChangedAt.value = null
      return
    }
    if (previous == null || current !== previous) {
      expLastChangedAt.value = Date.now()
    }
  },
)

watch(minimalMode, (enabled) => {
  document.body.classList.toggle('minimal-monitor-mode', enabled)
  applyMinimalTheme()
  if (defaultDocumentTitle) document.title = enabled ? '服务器存储监控' : defaultDocumentTitle
  if (enabled) startMinimalCharts()
  else stopMinimalCharts()
})

// 隐私模式下 localStorage 会抛异常，读写都不能让它把页面带崩。
function readStoredDarkTheme() {
  try {
    return localStorage.getItem(darkThemeKey) === '1'
  } catch {
    return false
  }
}

function storeDarkTheme(enabled: boolean) {
  try {
    localStorage.setItem(darkThemeKey, enabled ? '1' : '0')
  } catch {
    // 存不下就只在本次会话生效，不影响切换本身。
  }
}

/// 深色只在极简模式下生效，标准预览页本来就是深色主题。
function applyMinimalTheme() {
  document.body.classList.toggle(
    'minimal-dark-theme',
    minimalMode.value && minimalDark.value,
  )
}

function toggleMinimalDark() {
  minimalDark.value = !minimalDark.value
  storeDarkTheme(minimalDark.value)
  applyMinimalTheme()
}

function formatPercent(value: number) {
  return value.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
}

function startMinimalCharts() {
  if (cpuTimer === null) {
    cpuTimer = window.setInterval(() => {
      const previous = cpuSamples.value.at(-1) || 24
      const next = Math.max(8, Math.min(68, previous + Math.round((Math.random() - 0.5) * 12)))
      cpuSamples.value = [...cpuSamples.value.slice(1), next]
      // 顺带推进界面时钟，让「I/O 停滞」这类随时间变化的状态及时刷新。
      uiClock.value = Date.now()
    }, 1500)
  }
  if (writeTimer === null) {
    writeTimer = window.setInterval(sampleWriteRate, writeSampleSeconds * 1000)
  }
}

function stopMinimalCharts() {
  if (cpuTimer !== null) {
    clearInterval(cpuTimer)
    cpuTimer = null
  }
  if (writeTimer !== null) {
    clearInterval(writeTimer)
    writeTimer = null
  }
  lastSampledEXP = null
}

/// 取一格经验增量。
function sampleWriteRate() {
  const current = exp.value?.currentEXP ?? null
  if (current == null) {
    // 读不到经验时把基准也清掉，等下次读到时重新建立，
    // 否则跨过这段空白的第一格会变成一个假的巨大尖峰。
    lastSampledEXP = null
    pushWriteSample(0)
    return
  }
  const previous = lastSampledEXP
  lastSampledEXP = current
  if (previous == null) {
    pushWriteSample(0)
    return
  }
  // 升级或偶发误识别会让经验回落，负增量在写入速率语义下没有意义。
  pushWriteSample(Math.max(0, current - previous))
}

function pushWriteSample(value: number) {
  writeSamples.value = [...writeSamples.value.slice(1), value]
}

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
    if (message.exp) exp.value = message.exp
    else status.value = message.online ? '本机监控在线' : '本机监控离线'
    if (message.rune) rune.value = message.rune
    if (message.zone) zone.value = message.zone
    return
  }
  if (message.type === 'map') map.value = message.payload as MapPayload
  if (message.type === 'frame') frame.value = message.payload as FramePayload
  if (message.type === 'status') {
    const payload = message.payload as StatusPayload
    online.value = payload.online
    status.value = payload.message
  }
  if (message.type === 'exp') exp.value = message.payload as EXPPayload
  if (message.type === 'rune') rune.value = message.payload as RunePayload
  if (message.type === 'zone') zone.value = message.payload as ZonePayload
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

async function loadBarkSettings() {
  try {
    barkSettings.value = await apiRequest<BarkSettings>(`/api/preview/notifications/bark?token=${encodeURIComponent(token)}`)
    expStalledSeconds.value = barkSettings.value.expStalledSeconds
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '通知设置读取失败'
  }
}

async function toggleZoneBreach() {
  if (!barkSettings.value?.configured || barkBusy.value) return
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    barkSettings.value = await apiRequest<BarkSettings>(`/api/preview/notifications/zone-breach?token=${encodeURIComponent(token)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !barkSettings.value.zoneBreachEnabled }),
    })
    barkMessage.value = barkSettings.value.zoneBreachEnabled
      ? `离开安全区报警已开启，每 ${barkSettings.value.zoneBreachIntervalSeconds} 秒提醒一次`
      : '离开安全区报警已关闭'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '安全区开关更新失败'
  } finally {
    barkBusy.value = false
  }
}

async function updateEXPStalled(enabled: boolean) {
  if (!barkSettings.value?.configured || barkBusy.value) return
  expStalledSeconds.value = Math.min(86400, Math.max(10, Number(expStalledSeconds.value) || 120))
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    barkSettings.value = await apiRequest<BarkSettings>(`/api/preview/notifications/exp-stalled?token=${encodeURIComponent(token)}`, {
      method: 'PUT',
      body: JSON.stringify({
        enabled,
        seconds: expStalledSeconds.value,
      }),
    })
    expStalledSeconds.value = barkSettings.value.expStalledSeconds
    barkMessage.value = enabled
      ? `经验停滞推送已开启，每 ${expStalledSeconds.value} 秒提醒一次`
      : '经验停滞推送已关闭'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '经验停滞规则更新失败'
  } finally {
    barkBusy.value = false
  }
}

async function toggleRuneAlert() {
  if (!barkSettings.value?.configured || barkBusy.value) return
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    barkSettings.value = await apiRequest<BarkSettings>(`/api/preview/notifications/rune-alert?token=${encodeURIComponent(token)}`, {
      method: 'PUT',
      body: JSON.stringify({ enabled: !barkSettings.value.runeAlertEnabled }),
    })
    barkMessage.value = barkSettings.value.runeAlertEnabled
      ? `符文提示推送已开启，出现后每 ${barkSettings.value.runeAlertIntervalSeconds} 秒提醒一次`
      : '符文提示推送已关闭'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '符文提示开关更新失败'
  } finally {
    barkBusy.value = false
  }
}

async function saveEXPStalledSeconds() {
  if (!barkSettings.value) return
  await updateEXPStalled(barkSettings.value.expStalledEnabled)
}

async function testBark() {
  if (!barkSettings.value?.configured || barkBusy.value) return
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    await apiRequest(`/api/preview/notifications/bark/test?token=${encodeURIComponent(token)}`, { method: 'POST' })
    barkMessage.value = '测试通知已发送'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '测试通知发送失败'
  } finally {
    barkBusy.value = false
  }
}

onMounted(() => {
  defaultDocumentTitle = document.title
  if (minimalMode.value) {
    document.body.classList.add('minimal-monitor-mode')
    document.title = '服务器存储监控'
    applyMinimalTheme()
    startMinimalCharts()
  }
  connect()
  loadBarkSettings()
})
onBeforeUnmount(() => {
  document.body.classList.remove('minimal-monitor-mode')
  document.body.classList.remove('minimal-dark-theme')
  if (defaultDocumentTitle) document.title = defaultDocumentTitle
  stopMinimalCharts()
  if (reconnectTimer !== null) clearTimeout(reconnectTimer)
  socket?.close()
})
</script>

<template>
  <main v-if="minimalMode" class="minimal-preview">
    <p><strong>服务器存储监控</strong></p>
    <p>节点状态：{{ online ? '在线' : connected ? '等待数据' : '正在连接' }}</p>
    <label class="minimal-row">
      <input type="checkbox" :checked="minimalDark" @change="toggleMinimalDark" />
      <span>深色主题</span>
    </label>

    <section class="minimal-chart">
      <p>CPU 使用率：{{ cpuUsageText }}</p>
      <p>1 分钟负载：{{ cpuLoadText }}</p>
      <svg viewBox="0 0 260 56" aria-label="CPU 使用率变化曲线">
        <line x1="0" y1="18" x2="260" y2="18" />
        <line x1="0" y1="36" x2="260" y2="36" />
        <polyline :points="cpuPoints" />
      </svg>
    </section>

    <section class="minimal-chart">
      <p>磁盘写入速率：{{ writeRateText }}</p>
      <p>平均写入：{{ writeAverageText }}</p>
      <svg viewBox="0 0 260 56" aria-label="磁盘写入速率变化曲线">
        <line x1="0" y1="18" x2="260" y2="18" />
        <line x1="0" y1="36" x2="260" y2="36" />
        <polyline :points="writePoints" />
      </svg>
    </section>

    <details class="minimal-topology">
      <summary>存储节点映射</summary>
      <div class="minimal-map">
        <AnnotationStage
          :map="map"
          :frame="frame"
          :safe-zone="zoneRect"
          :safe-zone-breached="zoneOutside"
        />
      </div>
    </details>

    <section>
      <p>磁盘使用量：{{ diskUsageText }}</p>
      <p>磁盘使用率：{{ expPercentText }}</p>
      <p>写入锁定：{{ online ? (runeActive ? '已锁定' : '正常') : '等待节点上线' }}</p>
      <p>
        分区越界：{{ zoneConfigured ? (online ? (zoneOutside ? '已越界' : '正常') : '等待节点上线') : '未划分区' }}
      </p>
      <p>I/O 停滞：{{ expStalledStatusText }}</p>
    </section>

    <section>
      <p>告警通道：{{ barkSettings?.configured ? '已连接' : '等待连接' }}</p>
      <label class="minimal-row">
        <input
          type="checkbox"
          :checked="barkSettings?.runeAlertEnabled"
          :disabled="barkBusy || !barkSettings?.configured"
          @change="toggleRuneAlert"
        />
        <span>写入锁定告警</span>
      </label>
      <label class="minimal-row">
        <input
          type="checkbox"
          :checked="barkSettings?.zoneBreachEnabled"
          :disabled="barkBusy || !barkSettings?.configured"
          @change="toggleZoneBreach"
        />
        <span>分区越界告警</span>
      </label>
      <label class="minimal-row">
        <input
          type="checkbox"
          :checked="barkSettings?.expStalledEnabled"
          :disabled="barkBusy || !barkSettings?.configured"
          @change="updateEXPStalled(!barkSettings?.expStalledEnabled)"
        />
        <span>I/O 停滞告警</span>
      </label>
      <label class="minimal-row">
        <span>检测间隔：</span>
        <input
          v-model.number="expStalledSeconds"
          class="minimal-seconds"
          type="number"
          min="10"
          max="86400"
          step="10"
          :disabled="barkBusy || !barkSettings?.configured"
          aria-label="I/O 停滞检测间隔秒数"
          @change="saveEXPStalledSeconds"
        />
        <span>秒</span>
      </label>
      <button :disabled="barkBusy || !barkSettings?.configured" @click="testBark">
        {{ barkBusy ? '处理中…' : '测试告警通道' }}
      </button>
      <p v-if="barkError">同步失败</p>
      <p v-else-if="barkMessage">设置已同步</p>
    </section>
  </main>

  <main v-else class="preview-shell">
    <section class="preview-workspace">
      <section class="stage-frame">
        <AnnotationStage
          :map="map"
          :frame="frame"
          :safe-zone="zoneRect"
          :safe-zone-breached="zoneOutside"
        />
        <div v-if="!map && !frame" class="stage-empty"><div class="empty-orbit"><span></span></div><strong>等待标注数据</strong><p>请在本机 AutoBuff 中开始监控</p></div>
      </section>

      <aside class="telemetry-panel">
        <section class="telemetry-status">
          <div class="telemetry-heading">
            <span>实时状态</span>
            <div class="telemetry-heading-actions">
              <i :class="{ active: online }"></i>
              <RouterLink class="preview-mode-link" :to="minimalPath">极简版</RouterLink>
            </div>
          </div>
          <strong class="telemetry-map-name">{{ map?.name || '等待地图数据' }}</strong>
          <p>{{ channelStatusText }}</p>
        </section>

        <section class="exp-card">
          <div class="telemetry-heading"><span>经验数据</span></div>
          <div class="exp-values">
            <div><span>当前 EXP</span><strong class="mono">{{ expValueText }}</strong></div>
            <div><span>经验进度</span><strong class="mono accent-value">{{ expPercentText }}</strong></div>
          </div>
          <div class="confidence-row"><span>识别置信度</span><strong class="mono">{{ expConfidenceText }}</strong></div>
        </section>

        <section class="rune-card" :class="{ active: runeActive }">
          <div class="telemetry-heading">
            <span>符文诅咒</span>
            <small>{{ runeActive ? '已触发' : '正常' }}</small>
          </div>
          <strong class="rune-state">{{ runeStatusText }}</strong>
          <div class="confidence-row"><span>识别置信度</span><strong class="mono">{{ runeConfidenceText }}</strong></div>
        </section>

        <section class="rune-card" :class="{ active: zoneOutside }">
          <div class="telemetry-heading">
            <span>安全区</span>
            <small>{{ zoneConfigured ? (zoneOutside ? '已离开' : '区内') : '未设置' }}</small>
          </div>
          <strong class="rune-state">{{ zoneStatusText }}</strong>
          <div class="confidence-row"><span>范围占比</span><strong class="mono">{{ zoneSizeText }}</strong></div>
        </section>

        <section class="position-card">
          <span>玩家位置</span>
          <strong class="mono">{{ playerText }}</strong>
        </section>

        <section class="metric-grid">
          <div><span>队友</span><strong>{{ frame?.teammates.length || 0 }}</strong></div>
          <div><span>其他玩家</span><strong>{{ frame?.others.length || 0 }}</strong></div>
          <div class="fps-metric"><span>本机帧率</span><strong class="mono">{{ frame ? `${frame.sourceFPS.toFixed(1)} FPS` : '-- FPS' }}</strong></div>
        </section>

        <section class="notification-card">
          <div class="telemetry-heading"><span>Bark 推送</span><small>{{ barkSettings?.configured ? 'iPhone 已配置' : '等待配置' }}</small></div>
          <div class="notification-rule">
            <div>
              <strong>离开安全区报警</strong>
              <span>角色跑出矩形范围后每 {{ barkSettings?.zoneBreachIntervalSeconds ?? 5 }} 秒提醒一次，直到回到范围内</span>
            </div>
            <button
              class="toggle-button"
              :class="{ active: barkSettings?.zoneBreachEnabled }"
              :disabled="barkBusy || !barkSettings?.configured"
              :aria-pressed="barkSettings?.zoneBreachEnabled"
              @click="toggleZoneBreach"
            ><span></span></button>
          </div>
          <div class="notification-rule">
            <div>
              <strong>符文提示推送</strong>
              <span>出现紫色符文提示后每 {{ barkSettings?.runeAlertIntervalSeconds ?? 5 }} 秒提醒一次，直到解除</span>
            </div>
            <button
              class="toggle-button"
              :class="{ active: barkSettings?.runeAlertEnabled }"
              :disabled="barkBusy || !barkSettings?.configured"
              :aria-pressed="barkSettings?.runeAlertEnabled"
              @click="toggleRuneAlert"
            ><span></span></button>
          </div>
          <div class="notification-rule stalled-rule">
            <div><strong>经验无增长提醒</strong><span>持续无变化时按设定间隔重复推送并累计次数</span></div>
            <div class="stall-controls">
              <label>
                <input
                  v-model.number="expStalledSeconds"
                  class="stall-seconds"
                  type="number"
                  min="10"
                  max="86400"
                  step="10"
                  :disabled="barkBusy || !barkSettings?.configured"
                  aria-label="经验无增长提醒间隔秒数"
                  @change="saveEXPStalledSeconds"
                />
                <span>秒</span>
              </label>
              <button
                class="toggle-button"
                :class="{ active: barkSettings?.expStalledEnabled }"
                :disabled="barkBusy || !barkSettings?.configured"
                :aria-pressed="barkSettings?.expStalledEnabled"
                @click="updateEXPStalled(!barkSettings?.expStalledEnabled)"
              ><span></span></button>
            </div>
          </div>
          <p v-if="!barkSettings?.configured" class="notification-hint">请先登录控制台绑定 Bark DeviceKey</p>
          <p v-else-if="barkError" class="notification-error">{{ barkError }}</p>
          <p v-else-if="barkMessage" class="notification-success">{{ barkMessage }}</p>
          <button class="notification-test" :disabled="barkBusy || !barkSettings?.configured" @click="testBark">
            {{ barkBusy ? '处理中…' : '发送测试通知' }}
          </button>
        </section>
      </aside>
    </section>
  </main>
</template>
