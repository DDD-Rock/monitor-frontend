<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiRequest, getAccessToken } from '../api/client'
import { useAuthStore } from '../stores/auth'
import AnnotationStage from '../components/AnnotationStage.vue'
import BackButton from '../components/BackButton.vue'
import LogoMark from '../components/LogoMark.vue'
import type { BarkSettings, ManagedClient } from '../types/api'
import type { Envelope, EXPPayload, FramePayload, GainPayload, MapPayload, RunePayload, Snapshot, StatusPayload, VerificationPayload, ZonePayload } from '../types/protocol'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const minimalMode = computed(() => route.meta.minimal === true)
const darkThemeKey = 'minimalDarkTheme'
const minimalDark = ref(readStoredDarkTheme())
const standardFaviconURL = '/favicon.svg'
const disguisedFaviconURL = 'data:,'
const minimalPath = computed(() => ({
  path: '/dashboard/minimal',
  query: route.query.client ? { client: route.query.client } : {},
}))
const map = ref<MapPayload | null>(null)
const frame = ref<FramePayload | null>(null)
const exp = ref<EXPPayload | null>(null)
const rune = ref<RunePayload | null>(null)
const verification = ref<VerificationPayload | null>(null)
const zone = ref<ZonePayload | null>(null)
const gain = ref<GainPayload | null>(null)
const gainBusy = ref(false)
const online = ref(false)
const deviceConnected = ref(false)
const selectedClientID = ref('')
const selectedClientName = ref('')
const status = ref('正在连接监控服务…')
const connected = ref(false)
const reconnectAttempt = ref(0)
const barkSettings = ref<BarkSettings | null>(null)
const barkBusy = ref(false)
const barkMessage = ref('')
const barkError = ref('')
const criticalVolume = ref(5)
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
const frameArrivalTimes = ref<number[]>([])
let socket: WebSocket | null = null
let reconnectTimer: number | null = null
let cpuTimer: number | null = null
let writeTimer: number | null = null
let uiTimer: number | null = null
let lastSampledEXP: number | null = null
let defaultDocumentTitle = ''
let disposed = false

const playerText = computed(() => frame.value?.player ? `X ${(frame.value.player.x * 100).toFixed(1)} · Y ${(frame.value.player.y * 100).toFixed(1)}` : 'X -- · Y --')
const receivedFrameRateText = computed(() => {
  const cutoff = uiClock.value - 2000
  const samples = frameArrivalTimes.value.filter((value) => value >= cutoff)
  if (samples.length < 2) return '-- FPS'
  const elapsed = samples.at(-1)! - samples[0]
  if (elapsed <= 0) return '-- FPS'
  return `${(((samples.length - 1) * 1000) / elapsed).toFixed(1)} FPS`
})
const frameAgeText = computed(() => {
  if (!frame.value?.capturedAt) return '--'
  const age = Math.max(0, uiClock.value - frame.value.capturedAt)
  return age < 1000 ? `${Math.round(age)} ms` : `${(age / 1000).toFixed(1)} s`
})
const expValueText = computed(() => exp.value?.currentEXP == null ? '--' : exp.value.currentEXP.toLocaleString('zh-CN'))
const diskUsageText = computed(() => exp.value?.currentEXP == null ? '--' : `${expValueText.value} MB`)
const expPercentText = computed(() => exp.value?.percent == null ? '--%' : `${formatPercent(exp.value.percent)}%`)
const expConfidenceText = computed(() => exp.value?.confidence == null ? '--' : `${Math.round(exp.value.confidence * 100)}%`)
const expRecognitionMethodText = computed(() => {
  if (exp.value?.recognitionMethod === 'ppOCRv4') return 'PP-OCRv4'
  if (exp.value?.recognitionMethod === 'fixedTemplate') return '模板回退'
  return exp.value?.currentEXP == null ? '--' : '旧版客户端未上报'
})
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
  if (!deviceConnected.value) {
    return selectedClientName.value
      ? `${selectedClientName.value} 当前离线`
      : '已连接服务器，客户端当前离线'
  }
  return online.value ? '监控通道已建立' : '客户端已连接，等待启动监控模式'
})
const connectionPillText = computed(() => {
  if (!connected.value) return '连接服务器中'
  if (!deviceConnected.value) return '客户端离线'
  return online.value ? '监控在线' : '监控未启动'
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
const verificationActive = computed(() => online.value && verification.value?.detected === true)
const verificationStatusText = computed(() => {
  if (!online.value) return '等待本机上线'
  return verificationActive.value ? '出现鼠标跟随验证，请立即人工处理' : '未出现验证弹窗'
})
const verificationConfidenceText = computed(() =>
  verificationActive.value && verification.value?.confidence != null
    ? `${Math.round(verification.value.confidence * 100)}%`
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
const inflowText = computed(() => formatGainMB(gain.value?.inflow10m))
const outflowText = computed(() => formatGainMB(gain.value?.outflow1h))
const totalPackageText = computed(() => formatGainMB(gain.value?.totalUsage))
const dailyPackageText = computed(() => formatGainMB(gain.value?.dailyUsage))
const gainSampledText = computed(() => {
  if (!gain.value?.sampledAt) return '等待统计数据'
  return `更新于 ${new Date(gain.value.sampledAt).toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })}`
})
const expStalledDetailText = computed(() => {
  if (!online.value) return '本机离线'
  if (exp.value?.currentEXP == null) return '等待经验读数'
  if (!expStalledActive.value || expLastChangedAt.value === null) return '经验持续增长'
  const seconds = Math.max(0, Math.floor((uiClock.value - expLastChangedAt.value) / 1000))
  return `已连续 ${seconds} 秒没有增长`
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
  applyFavicon(enabled)
  if (defaultDocumentTitle) document.title = enabled ? '服务器存储监控' : defaultDocumentTitle
  if (enabled) startMinimalCharts()
  else stopMinimalCharts()
})

function applyFavicon(disguised: boolean) {
  let favicon = document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
  if (!favicon) {
    favicon = document.createElement('link')
    favicon.rel = 'icon'
    document.head.appendChild(favicon)
  }
  if (disguised) {
    favicon.removeAttribute('type')
    favicon.href = disguisedFaviconURL
  } else {
    favicon.type = 'image/svg+xml'
    favicon.href = standardFaviconURL
  }
}

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

function formatGainMB(value: number | null | undefined) {
  if (value == null) return '-- MB'
  return `${value.toLocaleString('zh-CN')} MB`
}

function startMinimalCharts() {
  if (cpuTimer === null) {
    cpuTimer = window.setInterval(() => {
      const previous = cpuSamples.value.at(-1) || 24
      const next = Math.max(8, Math.min(68, previous + Math.round((Math.random() - 0.5) * 12)))
      cpuSamples.value = [...cpuSamples.value.slice(1), next]
    }, 1500)
  }
}

// 这两项来自真实 EXP 数据，标准版和极简版都需要持续更新。
function startDataSampling() {
  if (writeTimer === null) {
    writeTimer = window.setInterval(sampleWriteRate, writeSampleSeconds * 1000)
  }
  if (uiTimer === null) {
    uiTimer = window.setInterval(() => {
      uiClock.value = Date.now()
    }, 1000)
  }
}

function stopMinimalCharts() {
  if (cpuTimer !== null) {
    clearInterval(cpuTimer)
    cpuTimer = null
  }
}

function stopDataSampling() {
  if (writeTimer !== null) {
    clearInterval(writeTimer)
    writeTimer = null
  }
  if (uiTimer !== null) {
    clearInterval(uiTimer)
    uiTimer = null
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

async function resolveViewerClient(): Promise<boolean> {
  const queryClientID = typeof route.query.client === 'string'
    ? route.query.client.trim()
    : ''
  const response = await apiRequest<{ clients: ManagedClient[] }>('/api/clients')
  const clients = Array.isArray(response.clients) ? response.clients : []
  const selected = queryClientID
    ? clients.find((client) => client.clientId === queryClientID)
    : clients.find((client) => client.online && client.mode === 'monitor' && client.running)
      ?? clients.find((client) => client.online)
      ?? clients[0]
  if (!selected) {
    status.value = queryClientID ? '指定的客户端不存在或已解绑' : '尚未绑定监控客户端'
    return false
  }
  selectedClientID.value = selected.clientId
  selectedClientName.value = selected.name
  deviceConnected.value = selected.online
  if (!queryClientID) {
    await router.replace({
      path: route.path,
      query: { ...route.query, client: selected.clientId },
    })
  }
  return true
}

function connect() {
  const accessToken = getAccessToken()
  if (!accessToken) {
    router.replace('/login')
    return
  }
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:'
  const clientID = selectedClientID.value
  const query = new URLSearchParams({ access_token: accessToken })
  if (clientID) query.set('client_id', clientID)
  socket = new WebSocket(`${protocol}//${location.host}/ws/view?${query}`)
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
    deviceConnected.value = false
    if (disposed) return
    scheduleReconnect()
  }
}

function applyFrame(payload: FramePayload) {
  const now = Date.now()
  frame.value = payload
  uiClock.value = now
  frameArrivalTimes.value = [...frameArrivalTimes.value, now].filter(
    (value) => value >= now - 2000,
  )
}

function applyMessage(message: Snapshot | Envelope) {
  if (message.type === 'snapshot') {
    online.value = message.online
    deviceConnected.value = message.connected ?? message.online
    if (message.map) map.value = message.map
    if (message.frame) applyFrame(message.frame)
    if (message.status) status.value = message.status.message
    else status.value = message.online
      ? '监控数据已连接'
      : deviceConnected.value ? '客户端在线，监控未启动' : '客户端离线'
    if (message.exp) exp.value = message.exp
    if (message.rune) rune.value = message.rune
    if (message.verification) verification.value = message.verification
    if (message.zone) zone.value = message.zone
    if (message.gain) gain.value = message.gain
    return
  }
  if (message.type === 'map') map.value = message.payload as MapPayload
  if (message.type === 'frame') applyFrame(message.payload as FramePayload)
  if (message.type === 'status') {
    const payload = message.payload as StatusPayload
    status.value = payload.message
  }
  if (message.type === 'exp') exp.value = message.payload as EXPPayload
  if (message.type === 'rune') rune.value = message.payload as RunePayload
  if (message.type === 'verification') verification.value = message.payload as VerificationPayload
  if (message.type === 'zone') zone.value = message.payload as ZonePayload
  if (message.type === 'gain') gain.value = message.payload as GainPayload
}

function scheduleReconnect() {
  if (disposed || reconnectTimer !== null) return
  const delay = Math.min(15000, 1000 * 2 ** reconnectAttempt.value++)
  status.value = `连接已断开，${Math.round(delay / 1000)} 秒后重试`
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null
    connect()
  }, delay)
}

async function loadBarkSettings() {
  try {
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/bark')
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
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/zone-breach', {
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
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/exp-stalled', {
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
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/rune-alert', {
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

async function toggleMouseFollowVerification() {
  if (!barkSettings.value?.configured || barkBusy.value) return
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/mouse-follow-verification', {
      method: 'PUT',
      body: JSON.stringify({ enabled: !barkSettings.value.mouseFollowVerificationEnabled }),
    })
    barkMessage.value = barkSettings.value.mouseFollowVerificationEnabled
      ? `鼠标跟随验证紧急推送已开启，出现后每 ${barkSettings.value.mouseFollowVerificationIntervalSeconds} 秒提醒一次`
      : '鼠标跟随验证紧急推送已关闭'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '鼠标跟随验证开关更新失败'
  } finally {
    barkBusy.value = false
  }
}

async function toggleUrgentMute() {
  if (!barkSettings.value?.configured || barkBusy.value) return
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    barkSettings.value = await apiRequest<BarkSettings>('/api/notifications/urgent-mute', {
      method: 'PUT',
      body: JSON.stringify({ muted: !barkSettings.value.urgentAlertsMuted }),
    })
    barkMessage.value = barkSettings.value.urgentAlertsMuted
      ? '符文和鼠标跟随紧急警报已静音'
      : '紧急警报声音已开启，每次事件第一次音量为 4'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '紧急警报静音设置更新失败'
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
    await apiRequest('/api/notifications/bark/test', { method: 'POST' })
    barkMessage.value = '测试通知已发送'
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '测试通知发送失败'
  } finally {
    barkBusy.value = false
  }
}

async function testCriticalBark() {
	if (!barkSettings.value?.configured || barkBusy.value) return
	criticalVolume.value = Math.min(10, Math.max(0, Number(criticalVolume.value) || 0))
  barkBusy.value = true
  barkError.value = ''
  barkMessage.value = ''
  try {
    await apiRequest('/api/notifications/bark/test-critical', {
      method: 'POST',
      body: JSON.stringify({ volume: criticalVolume.value }),
    })
    barkMessage.value = `紧急测试通知已发送，音量 ${criticalVolume.value}`
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '紧急测试通知发送失败'
  } finally {
    barkBusy.value = false
  }
}

async function loadGain() {
  try {
    gain.value = await apiRequest<GainPayload>('/api/monitor/exp-gain')
  } catch {
    // WebSocket 推送仍会补上；这里失败不打扰极简页主流程。
  }
}

async function resetTotalPackage() {
  if (gainBusy.value) return
  if (!window.confirm('确定清空总资源包用量？当日用量和流量窗口不会一起清。')) return
  gainBusy.value = true
  try {
    gain.value = await apiRequest<GainPayload>(
      '/api/monitor/exp-gain/reset-total',
      { method: 'POST' },
    )
  } catch (caught) {
    barkError.value = caught instanceof Error ? caught.message : '清空总资源包用量失败'
  } finally {
    gainBusy.value = false
  }
}

onMounted(async () => {
  if (!(await auth.restore())) {
    await router.replace('/login')
    return
  }
  defaultDocumentTitle = document.title
  if (minimalMode.value) {
    document.body.classList.add('minimal-monitor-mode')
    document.title = '服务器存储监控'
    applyFavicon(true)
    applyMinimalTheme()
    startMinimalCharts()
  }
  try {
    if (!(await resolveViewerClient())) return
  } catch (caught) {
    status.value = caught instanceof Error ? caught.message : '读取客户端列表失败'
    return
  }
  connect()
  startDataSampling()
  loadBarkSettings()
  loadGain()
})
onBeforeUnmount(() => {
  disposed = true
  document.body.classList.remove('minimal-monitor-mode')
  document.body.classList.remove('minimal-dark-theme')
  applyFavicon(false)
  if (defaultDocumentTitle) document.title = defaultDocumentTitle
  stopMinimalCharts()
  stopDataSampling()
  if (reconnectTimer !== null) clearTimeout(reconnectTimer)
  socket?.close()
})
</script>

<template>
  <main v-if="minimalMode" class="minimal-preview">
    <p><strong>服务器存储监控</strong></p>
    <p>节点状态：{{ connectionPillText }}</p>
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
      <p>流入流量：{{ inflowText }}</p>
      <p>流出流量：{{ outflowText }}</p>
      <p>总资源包用量：{{ totalPackageText }}</p>
      <p>当日资源包用量：{{ dailyPackageText }}</p>
      <button :disabled="gainBusy" @click="resetTotalPackage">
        {{ gainBusy ? '处理中…' : '清空总资源包用量' }}
      </button>
      <p>写入锁定：{{ online ? (runeActive ? '已锁定' : '正常') : '等待节点上线' }}</p>
      <p>交互验证：{{ online ? (verificationActive ? '需要处理' : '正常') : '等待节点上线' }}</p>
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
          :checked="barkSettings?.mouseFollowVerificationEnabled"
          :disabled="barkBusy || !barkSettings?.configured"
          @change="toggleMouseFollowVerification"
        />
        <span>交互验证紧急告警</span>
      </label>
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
    <header class="preview-topbar">
      <div class="preview-topbar-start">
        <BackButton />
        <div class="preview-brand">
          <LogoMark class="preview-brand-mark" />
          <div>
            <strong>AutoBuff Monitor</strong>
            <span>实时作业中心</span>
          </div>
        </div>
      </div>
      <div class="preview-topbar-actions">
        <span class="connection-pill" :class="{ online }">
          <i></i>{{ connectionPillText }}
        </span>
        <RouterLink class="preview-nav-link" to="/manual">使用手册</RouterLink>
        <RouterLink class="preview-nav-link" to="/functions">功能中心</RouterLink>
        <RouterLink class="preview-nav-link" to="/settings">设置</RouterLink>
        <RouterLink class="preview-nav-link" :to="minimalPath">极简模式</RouterLink>
      </div>
    </header>

    <section class="preview-workspace">
      <section class="monitor-main">
        <section class="stage-frame">
          <div class="stage-toolbar">
            <div>
              <span>当前地图</span>
              <strong>{{ map?.name || '等待地图数据' }}</strong>
            </div>
            <span class="stage-coordinate mono">{{ playerText }}</span>
          </div>
          <AnnotationStage
            :map="map"
            :frame="frame"
            :safe-zone="zoneRect"
            :safe-zone-breached="zoneOutside"
          />
          <div class="stage-legend">
            <span><i class="legend-player"></i>本人</span>
            <span><i class="legend-team"></i>队友 {{ frame?.teammates.length || 0 }}</span>
            <span><i class="legend-other"></i>其他 {{ frame?.others.length || 0 }}</span>
            <span class="mono">{{ frame ? `${frame.sourceFPS.toFixed(1)} FPS` : '-- FPS' }}</span>
          </div>
          <div v-if="!map && !frame" class="stage-empty"><div class="empty-orbit"><span></span></div><strong>等待标注数据</strong><p>请在本机 AutoBuff 中开始监控</p></div>
        </section>

        <section class="performance-strip">
          <div class="performance-metric primary-metric">
            <span>当前经验</span>
            <strong class="mono">{{ expValueText }}</strong>
            <small>{{ expRecognitionMethodText }} · 置信度 {{ expConfidenceText }}</small>
          </div>
          <div class="performance-metric">
            <span>当前进度</span>
            <strong class="mono accent-value">{{ expPercentText }}</strong>
            <small>{{ gainSampledText }}</small>
          </div>
          <div class="performance-metric rate-metric">
            <div>
              <span>实时增长速率</span>
              <strong class="mono">{{ writeRateText.replace('MB/s', 'EXP/s') }}</strong>
              <small>近 90 秒均值 {{ writeAverageText.replace('MB/s', 'EXP/s') }}</small>
            </div>
            <svg viewBox="0 0 260 56" aria-label="经验增长速率变化曲线">
              <line x1="0" y1="18" x2="260" y2="18" />
              <line x1="0" y1="36" x2="260" y2="36" />
              <polyline :points="writePoints" />
            </svg>
          </div>
          <div class="performance-metric stalled-metric" :class="{ alert: expStalledActive }">
            <span>增长状态</span>
            <strong>{{ expStalledStatusText }}</strong>
            <small>{{ expStalledDetailText }}</small>
          </div>
        </section>
      </section>

      <aside class="telemetry-panel">
        <section class="telemetry-status overview-card">
          <div class="telemetry-heading">
            <span>监控概览</span>
            <i :class="{ active: online }"></i>
          </div>
          <p>{{ channelStatusText }}</p>
          <div class="overview-grid">
            <div><span>玩家位置</span><strong class="mono">{{ playerText }}</strong></div>
            <div><span>安全区</span><strong>{{ zoneConfigured ? (zoneOutside ? '已离开' : '区内') : '未设置' }}</strong></div>
            <div><span>网页收帧</span><strong class="mono">{{ receivedFrameRateText }}</strong></div>
            <div><span>位置帧龄</span><strong class="mono">{{ frameAgeText }}</strong></div>
          </div>
        </section>

        <section class="gain-card">
          <div class="telemetry-heading"><span>经验收益</span><small>{{ gainSampledText }}</small></div>
          <div class="gain-grid">
            <div><span>近 10 分钟</span><strong class="mono">{{ inflowText.replace(' MB', '') }}</strong><small>EXP</small></div>
            <div><span>近 1 小时</span><strong class="mono">{{ outflowText.replace(' MB', '') }}</strong><small>EXP</small></div>
            <div><span>累计收益</span><strong class="mono">{{ totalPackageText.replace(' MB', '') }}</strong><small>EXP</small></div>
            <div><span>今日收益</span><strong class="mono">{{ dailyPackageText.replace(' MB', '') }}</strong><small>EXP</small></div>
          </div>
          <button class="gain-reset" :disabled="gainBusy" @click="resetTotalPackage">
            {{ gainBusy ? '处理中…' : '重置累计收益' }}
          </button>
        </section>

        <section class="event-card">
          <div class="telemetry-heading"><span>风险状态</span><small>实时同步</small></div>
          <div class="event-row" :class="{ alert: verificationActive }">
            <i></i>
            <div><strong>鼠标跟随验证</strong><span>{{ verificationStatusText }}</span></div>
            <small class="mono">{{ verificationConfidenceText }}</small>
          </div>
          <div class="event-row" :class="{ alert: runeActive }">
            <i></i>
            <div><strong>符文诅咒</strong><span>{{ runeStatusText }}</span></div>
            <small class="mono">{{ runeConfidenceText }}</small>
          </div>
          <div class="event-row" :class="{ alert: zoneOutside }">
            <i></i>
            <div><strong>安全区</strong><span>{{ zoneStatusText }}</span></div>
            <small class="mono">{{ zoneSizeText }}</small>
          </div>
          <div class="event-row" :class="{ alert: expStalledActive }">
            <i></i>
            <div><strong>经验增长</strong><span>{{ expStalledDetailText }}</span></div>
            <small>{{ expStalledStatusText }}</small>
          </div>
        </section>

        <section class="notification-card">
          <div class="telemetry-heading"><span>告警规则</span><small>{{ barkSettings?.configured ? 'Bark 已连接' : '等待配置' }}</small></div>
          <div class="notification-rule">
            <div>
              <strong>符文 / 鼠标跟随静音</strong>
              <span>开启后整段事件都静音；关闭时每次事件仅第一次以音量 4 提醒</span>
            </div>
            <button
              class="toggle-button"
              :class="{ active: barkSettings?.urgentAlertsMuted }"
              :disabled="barkBusy || !barkSettings?.configured"
              :aria-pressed="barkSettings?.urgentAlertsMuted"
              aria-label="符文和鼠标跟随紧急警报静音"
              @click="toggleUrgentMute"
            ><span></span></button>
          </div>
          <div class="notification-rule">
            <div>
              <strong>鼠标跟随验证紧急推送</strong>
              <span>紧急通知；首次音量 {{ barkSettings?.urgentAlertsMuted ? 0 : 4 }}，之后音量 0，每 {{ barkSettings?.mouseFollowVerificationIntervalSeconds ?? 5 }} 秒重复</span>
            </div>
            <button
              class="toggle-button"
              :class="{ active: barkSettings?.mouseFollowVerificationEnabled }"
              :disabled="barkBusy || !barkSettings?.configured"
              :aria-pressed="barkSettings?.mouseFollowVerificationEnabled"
              @click="toggleMouseFollowVerification"
            ><span></span></button>
          </div>
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
              <span>紧急通知；首次音量 {{ barkSettings?.urgentAlertsMuted ? 0 : 4 }}，之后音量 0，每 {{ barkSettings?.runeAlertIntervalSeconds ?? 5 }} 秒重复</span>
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
          <div class="critical-test-controls compact">
            <label>紧急音量 <input v-model.number="criticalVolume" type="number" min="0" max="10" step="1" /></label>
            <button class="notification-test critical" :disabled="barkBusy || !barkSettings?.configured" @click="testCriticalBark">
              {{ barkBusy ? '处理中…' : '发送紧急测试通知' }}
            </button>
          </div>
        </section>
      </aside>
    </section>
  </main>
</template>
