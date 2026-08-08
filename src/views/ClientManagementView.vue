<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest, getAccessToken } from '../api/client'
import BackButton from '../components/BackButton.vue'
import LogoMark from '../components/LogoMark.vue'
import { useAuthStore } from '../stores/auth'
import type { ManagedClient, RopeTeam } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const clients = ref<ManagedClient[]>([])
const connected = ref(false)
const error = ref('')
const pending = ref(new Set<string>())
const deletingClientID = ref<string | null>(null)
const roleDrafts = ref<Record<string, string>>({})
const savingRoleClientID = ref<string | null>(null)
const ropeTeam = ref<RopeTeam | null>(null)
const teamDialog = ref<HTMLDialogElement | null>(null)
const selectedTeamMembers = ref(new Set<string>())
const selectedLeaderID = ref('')
const teamSaving = ref(false)
const teamDisbanding = ref(false)
const removingTeamMemberID = ref<string | null>(null)
const bossRoleDraft = ref('')
const bossRoleSaving = ref(false)
const teamError = ref('')
const teamNotice = ref('')
let socket: WebSocket | null = null
let reconnectTimer: number | null = null
let teamNoticeTimer: number | null = null

function showTeamNotice(message: string, clearAfterMs = 0) {
  teamNotice.value = message
  if (teamNoticeTimer !== null) window.clearTimeout(teamNoticeTimer)
  teamNoticeTimer = clearAfterMs > 0
    ? window.setTimeout(() => { teamNotice.value = ''; teamNoticeTimer = null }, clearAfterMs)
    : null
}

const onlineCount = computed(() => clients.value.filter((item) => item.online).length)
const teamConfigurationBlocked = computed(() =>
  ropeTeam.value !== null && ropeTeam.value.bossCycleState !== 'idle',
)
const activeMonitorClientID = computed(() => clients.value.find(
  (item) => item.online && item.mode === 'monitor' && item.running,
)?.clientId ?? null)
const modeNames: Record<ManagedClient['mode'], string> = {
  dead: '死花模式',
  live: '活花模式',
  temple: '神殿模式',
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
    const message = JSON.parse(event.data) as { type: string; clients?: ManagedClient[]; ropeTeam?: RopeTeam | null }
    if (message.type === 'clients' && message.clients) {
      clients.value = message.clients
      ropeTeam.value = message.ropeTeam ?? null
      if (ropeTeam.value && !bossRoleSaving.value) bossRoleDraft.value = ropeTeam.value.bossRoleName
      for (const client of message.clients) {
        if (!(client.clientId in roleDrafts.value)) roleDrafts.value[client.clientId] = client.roleName
      }
      pending.value = new Set()
    }
  }
  socket.onerror = () => { error.value = '实时连接暂时不可用，正在重试…' }
  socket.onclose = () => {
    connected.value = false
    reconnectTimer = window.setTimeout(connect, 2000)
  }
}

async function saveRoleName(client: ManagedClient) {
  const roleName = (roleDrafts.value[client.clientId] ?? '').trim()
  if (!roleName || [...roleName].length > 24) {
    error.value = '角色名称须为 1–24 个字符'
    return
  }
  savingRoleClientID.value = client.clientId
  error.value = ''
  try {
    await apiRequest('/api/clients/role-name', {
      method: 'PUT',
      body: JSON.stringify({ clientId: client.clientId, roleName }),
    })
    client.roleName = roleName
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '角色名称保存失败'
  } finally {
    savingRoleClientID.value = null
  }
}

const eligibleTeamClients = computed(() => clients.value.filter((client) => client.roleName.trim()))

function openTeamDialog() {
  const members = ropeTeam.value?.members.map((member) => member.sessionId) ?? []
  selectedTeamMembers.value = new Set(members)
  selectedLeaderID.value = ropeTeam.value?.leaderSessionId ?? ''
  teamError.value = ''
  teamDialog.value?.showModal()
}

function toggleTeamMember(sessionID: string, checked: boolean) {
  const next = new Set(selectedTeamMembers.value)
  if (checked) {
    if (next.size >= 5) return
    next.add(sessionID)
    if (!next.has(selectedLeaderID.value)) selectedLeaderID.value = sessionID
  } else {
    next.delete(sessionID)
    if (selectedLeaderID.value === sessionID) {
      selectedLeaderID.value = next.values().next().value ?? ''
    }
  }
  selectedTeamMembers.value = next
}

async function saveTeam() {
  if (selectedTeamMembers.value.size < 1 || selectedTeamMembers.value.size > 5) {
    teamError.value = '请选择 1–5 个客户端'
    return
  }
  if (!selectedTeamMembers.value.has(selectedLeaderID.value)) {
    teamError.value = '请从已选客户端中指定一名队长'
    return
  }
  teamSaving.value = true
  teamError.value = ''
  try {
    const response = await apiRequest<{ team: RopeTeam; firstCreation: boolean; leaderChanging: boolean }>('/api/rope-team', {
      method: 'PUT',
      body: JSON.stringify({
        leaderSessionId: selectedLeaderID.value,
        memberSessionIds: [...selectedTeamMembers.value],
      }),
    })
    ropeTeam.value = response.team
    teamNotice.value = response.leaderChanging
      ? '队长正在退出原游戏队伍，退出完成后新队长将创建队伍并重新邀请成员。'
      : response.firstCreation
      ? '队伍已创建，客户端正在切换模式并发送邀请。'
      : '队伍配置已保存，客户端正在重新进入挂绳组队模式。'
    teamDialog.value?.close()
  } catch (caught) {
    teamError.value = caught instanceof Error ? caught.message : '队伍保存失败'
  } finally {
    teamSaving.value = false
  }
}

async function disbandTeam() {
  if (!ropeTeam.value || teamDisbanding.value) return
  const leader = ropeTeam.value.members.find((member) => member.isLeader)
  const leaderName = leader?.roleName || '当前队长'
  const commandNotice = leader?.online
    ? `${leaderName} 所在客户端会同时尝试发送“/退出隊伍”。`
    : `${leaderName} 当前离线，网页队伍仍会直接解散；下次创建时客户端会先尝试退出旧队伍。`
  if (!confirm(`确定解散当前队伍吗？\n\n${commandNotice}`)) return
  teamDisbanding.value = true
  teamError.value = ''
  error.value = ''
  try {
    const response = await apiRequest<{ commandSent: boolean }>('/api/rope-team', { method: 'DELETE' })
    ropeTeam.value = null
    showTeamNotice(response.commandSent
      ? '队伍已解散，已通知队长客户端退出游戏队伍。'
      : '队伍已解散；队长客户端未在线，下次创建队伍时会先尝试退出旧队伍。', 5000)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '队伍解散失败'
  } finally {
    teamDisbanding.value = false
  }
}

async function removeTeamMember(member: RopeTeam['members'][number]) {
  if (!ropeTeam.value || member.isLeader || removingTeamMemberID.value) return
  if (!confirm(`确定将“${member.roleName}”移出队伍吗？\n\n队长客户端会在游戏聊天框发送“/踢出隊伍 ${member.roleName}”。`)) return
  removingTeamMemberID.value = member.sessionId
  teamError.value = ''
  error.value = ''
  try {
    const response = await apiRequest<{ team: RopeTeam }>(
      `/api/rope-team/members/${encodeURIComponent(member.sessionId)}`,
      { method: 'DELETE' },
    )
    ropeTeam.value = response.team
    teamNotice.value = `已移除 ${member.roleName}，队长客户端正在发送踢出指令。`
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '移除队伍成员失败'
  } finally {
    removingTeamMemberID.value = null
  }
}

async function saveBossRoleName() {
  const roleName = bossRoleDraft.value.trim()
  if (!ropeTeam.value || !roleName || [...roleName].length > 24 || bossRoleSaving.value) {
    error.value = '目标老板名称须为 1–24 个字符'
    return
  }
  bossRoleSaving.value = true
  error.value = ''
  try {
    const response = await apiRequest<{ team: RopeTeam; cycleStarted: boolean; leaderOnline: boolean; alreadyActive: boolean; startReason: string }>('/api/rope-team/boss', {
      method: 'PUT',
      body: JSON.stringify({ roleName }),
    })
    ropeTeam.value = response.team
    bossRoleDraft.value = response.team.bossRoleName
    showTeamNotice(response.cycleStarted
      ? `目标老板已设置为 ${roleName}，队长客户端已开始邀请。`
      : response.alreadyActive
        ? `目标老板仍为 ${roleName}，当前邀请流程已在运行，不会重复执行。`
      : response.leaderOnline
        ? response.startReason === 'leader_unavailable'
          ? `目标老板已设置为 ${roleName}，但队长客户端暂时无法接收邀请指令。`
          : `目标老板已设置为 ${roleName}，但周期启动失败（${response.startReason}）。`
        : `目标老板已设置为 ${roleName}，但队长当前离线，无法邀请老板。`, 5000)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '目标老板名称保存失败'
  } finally {
    bossRoleSaving.value = false
  }
}

function bossCycleLabel(team: RopeTeam) {
  const leader = team.members.find((member) => member.isLeader)
  if (team.bossRoleName && !leader?.online) return '队长离线，无法邀请老板'
  return {
    idle: '等待 Buff 临期',
    inviting: '正在邀请老板',
    casting: '全员释放 Buff',
    kicking: '正在结束本轮',
    disbanding: '正在解散并重建队伍',
    changing_leader: '正在更换队长',
  }[team.bossCycleState]
}

function control(client: ManagedClient) {
  if (!socket || socket.readyState !== WebSocket.OPEN || !client.online || startBlocked(client)) return
  pending.value = new Set(pending.value).add(client.clientId)
  socket.send(JSON.stringify({
    type: 'command',
    clientId: client.clientId,
    action: client.running ? 'stop' : 'start',
  }))
}

function startBlocked(client: ManagedClient) {
  return !client.running && client.mode === 'monitor' &&
    activeMonitorClientID.value !== null && activeMonitorClientID.value !== client.clientId
}

async function deleteClient(client: ManagedClient) {
  const warning = client.online
    ? '该客户端当前在线。解绑后会立即停止功能并退出登录，确定继续吗？'
    : '该客户端当前离线。解绑后下次上线会自动退出登录，确定继续吗？'
  if (!confirm(`确定解绑“${client.name}”吗？\n\n${warning}`)) return

  deletingClientID.value = client.id
  error.value = ''
  try {
    await apiRequest(`/api/clients/${client.id}`, { method: 'DELETE' })
    clients.value = clients.value.filter((item) => item.id !== client.id)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '解绑客户端失败'
  } finally {
    deletingClientID.value = null
  }
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
  if (teamNoticeTimer !== null) clearTimeout(teamNoticeTimer)
  socket?.close()
})
</script>

<template>
  <main class="portal-shell">
    <header class="portal-topbar">
      <div class="portal-topbar-start"><BackButton /><RouterLink class="portal-logo" to="/functions"><LogoMark />AutoBuff</RouterLink></div>
      <nav><RouterLink to="/functions">功能中心</RouterLink><RouterLink class="manual-entry" to="/manual"><span aria-hidden="true">?</span>使用手册</RouterLink><strong>客户端管理</strong></nav>
    </header>
    <section class="portal-content manage-content">
      <div class="manage-heading">
        <div><p class="portal-kicker">CLIENTS</p><h1>客户端管理</h1><p>每台设备都有一个独一无二的名字，客户端界面会显示同一个名字。</p></div>
        <div class="manage-heading-actions"><button class="team-create-button" :disabled="!eligibleTeamClients.length || teamConfigurationBlocked" :title="teamConfigurationBlocked ? '当前队伍流程结束后才能修改队伍' : ''" @click="openTeamDialog">{{ ropeTeam ? '修改队伍' : '创建队伍' }}</button><span class="live-summary" :class="{ active: connected }">{{ onlineCount }} 台在线</span></div>
      </div>
      <p v-if="error" class="inline-notice">{{ error }}</p>
      <p v-if="teamNotice" class="inline-success">{{ teamNotice }}</p>
      <section v-if="ropeTeam" class="rope-team-summary">
        <div><p class="portal-kicker">ROPE PARTY</p><h2>挂绳队伍</h2></div>
        <ul><li v-for="member in ropeTeam.members" :key="member.sessionId"><strong>{{ member.roleName }}</strong><span>{{ ropeTeam.bossCycleState === 'casting' ? (!member.online ? '离线跳过' : member.bossBuffCompleted ? 'BUFF已完成' : '等待BUFF') : member.isLeader ? (ropeTeam.createdInGame ? '已创建队伍' : '正在建队') : member.joined ? '已进队' : member.invited ? '已发送邀请' : '等待邀请' }}</span><i :class="{ joined: member.bossBuffCompleted || member.joined || (member.isLeader && ropeTeam.createdInGame), invited: member.invited && !member.joined, skipped: ropeTeam.bossCycleState === 'casting' && !member.online }"></i><button v-if="!member.isLeader" class="team-member-remove" :disabled="removingTeamMemberID !== null" :title="`移除 ${member.roleName}`" @click="removeTeamMember(member)">{{ removingTeamMemberID === member.sessionId ? '移除中…' : '移除' }}</button></li></ul>
        <div class="rope-boss-config"><input v-model="bossRoleDraft" maxlength="24" placeholder="目标老板角色名" :disabled="!ropeTeam.createdInGame || ropeTeam.bossCycleState !== 'idle'"><button :disabled="bossRoleSaving || !ropeTeam.createdInGame || ropeTeam.bossCycleState !== 'idle'" @click="saveBossRoleName">{{ bossRoleSaving ? '保存中…' : ropeTeam.bossCycleState !== 'idle' ? '流程进行中' : '保存老板' }}</button><small>{{ ropeTeam.createdInGame ? bossCycleLabel(ropeTeam) : '等待队长完成建队' }}</small></div>
        <button class="team-disband-button" :disabled="teamDisbanding" @click="disbandTeam">{{ teamDisbanding ? '解散中…' : '解散队伍' }}</button>
      </section>
      <div v-if="clients.length" class="client-grid">
        <article v-for="client in clients" :key="client.id" class="client-card">
          <div class="client-card-head">
            <span class="device-orb" :class="{ online: client.online }">⌘</span>
            <div><h2>{{ client.name }}</h2><p>{{ client.online ? '实时连接中' : `最后连接：${formatLastSeen(client.lastSeenAt)}` }}</p></div>
            <i :class="{ online: client.online }"></i>
          </div>
          <dl><div><dt>当前模式</dt><dd>{{ modeNames[client.mode] }}</dd></div><div><dt>运行状态</dt><dd :class="{ running: client.running }">{{ client.running ? '运行中' : '已停止' }}</dd></div><div class="role-name-field"><dt>角色名称</dt><dd><input v-model="roleDrafts[client.clientId]" maxlength="24" placeholder="填写游戏角色名"><button :disabled="savingRoleClientID === client.clientId" @click="saveRoleName(client)">{{ savingRoleClientID === client.clientId ? '保存中' : '保存' }}</button></dd></div></dl>
          <div class="client-actions">
            <button :class="{ stop: client.running }" :disabled="!client.online || pending.has(client.clientId) || deletingClientID === client.id || startBlocked(client)" :title="startBlocked(client) ? '同一账号只能有一个客户端运行监控模式' : ''" @click="control(client)">
              {{ pending.has(client.clientId) ? '等待客户端…' : startBlocked(client) ? '其他客户端监控中' : client.running ? '停止' : '开始' }}
            </button>
            <button class="danger" :disabled="deletingClientID === client.id" @click="deleteClient(client)">
              {{ deletingClientID === client.id ? '解绑中…' : '解绑客户端' }}
            </button>
          </div>
        </article>
      </div>
      <section v-else class="empty-portal"><span>⌘</span><h2>还没有客户端</h2><p>请先在 AutoBuff 客户端登录当前账号，连接后会自动出现在这里。</p></section>
    </section>
    <dialog ref="teamDialog" class="client-admin-dialog team-dialog">
      <header><div><p class="portal-kicker">ROPE PARTY</p><h2>{{ ropeTeam ? '修改队伍' : '创建队伍' }}</h2></div><button class="dialog-close" aria-label="关闭" @click="teamDialog?.close()">×</button></header>
      <p class="dialog-help">选择 1–5 个已填写角色名称的客户端，并指定一名队长。保存后所有成员会停止当前功能，切换到神殿挂绳组队并重新开始。</p>
      <p v-if="teamError" class="inline-notice">{{ teamError }}</p>
      <div class="team-member-picker">
        <label v-for="client in eligibleTeamClients" :key="client.id" class="team-member-option" :class="{ selected: selectedTeamMembers.has(client.id) }">
          <input type="checkbox" :checked="selectedTeamMembers.has(client.id)" :disabled="!selectedTeamMembers.has(client.id) && (!client.online || selectedTeamMembers.size >= 5)" @change="toggleTeamMember(client.id, ($event.target as HTMLInputElement).checked)">
          <span><strong>{{ client.roleName }}</strong><small>{{ client.name }} · {{ client.online ? '在线' : '离线' }}</small></span>
          <label class="leader-choice" @click.stop><input v-model="selectedLeaderID" type="radio" name="leader" :value="client.id" :disabled="!selectedTeamMembers.has(client.id)">队长</label>
        </label>
      </div>
      <footer class="team-dialog-actions"><span>已选择 {{ selectedTeamMembers.size }}/5</span><button class="secondary" @click="teamDialog?.close()">取消</button><button :disabled="teamSaving" @click="saveTeam">{{ teamSaving ? '保存中…' : '保存并执行' }}</button></footer>
    </dialog>
  </main>
</template>
