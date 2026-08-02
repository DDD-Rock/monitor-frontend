<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import BackButton from '../components/BackButton.vue'
import LogoMark from '../components/LogoMark.vue'
import { useAuthStore } from '../stores/auth'
import type { AdminInviteCode } from '../types/api'

const auth = useAuthStore()
const router = useRouter()
const inviteCodes = ref<AdminInviteCode[]>([])
const durationChoice = ref('1800')
const customDuration = ref(30)
const customUnit = ref<'minutes' | 'hours' | 'days'>('minutes')
const generating = ref(false)
const deletingID = ref<number | null>(null)
const error = ref('')
const createdCode = ref<AdminInviteCode | null>(null)
const copiedCode = ref('')
const now = ref(Date.now())
let clock: number | undefined

const durationSeconds = computed(() => {
  if (durationChoice.value !== 'custom') return Number(durationChoice.value)
  const multiplier = customUnit.value === 'minutes' ? 60 : customUnit.value === 'hours' ? 3600 : 86400
  return customDuration.value * multiplier
})

async function load() {
  const response = await apiRequest<{ inviteCodes: AdminInviteCode[] }>('/api/admin/invite-codes')
  inviteCodes.value = response.inviteCodes
}

async function generate() {
  if (!Number.isInteger(durationSeconds.value) || durationSeconds.value < 60 || durationSeconds.value > 365 * 86400) {
    error.value = '有效时长须在 1 分钟到 365 天之间'
    return
  }
  generating.value = true
  error.value = ''
  try {
    const item = await apiRequest<AdminInviteCode>('/api/admin/invite-codes', {
      method: 'POST',
      body: JSON.stringify({ durationSeconds: durationSeconds.value }),
    })
    createdCode.value = item
    inviteCodes.value = [item, ...inviteCodes.value.filter((existing) => existing.id !== item.id)]
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '邀请码生成失败'
  } finally {
    generating.value = false
  }
}

async function copyCode(code: string) {
  try {
    await navigator.clipboard.writeText(code)
    copiedCode.value = code
    window.setTimeout(() => { if (copiedCode.value === code) copiedCode.value = '' }, 1800)
  } catch {
    error.value = '复制失败，请手动选择邀请码'
  }
}

async function deleteCode(item: AdminInviteCode) {
  if (!confirm(`确定删除邀请码“${item.code}”吗？删除后无法恢复。`)) return
  deletingID.value = item.id
  error.value = ''
  try {
    await apiRequest(`/api/admin/invite-codes/${item.id}`, { method: 'DELETE' })
    inviteCodes.value = inviteCodes.value.filter((existing) => existing.id !== item.id)
    if (createdCode.value?.id === item.id) createdCode.value = null
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '邀请码删除失败'
  } finally {
    deletingID.value = null
  }
}

function statusOf(item: AdminInviteCode) {
  if (item.usedAt) return 'used'
  if (item.expiresAt <= now.value) return 'expired'
  return 'active'
}

function statusText(item: AdminInviteCode) {
  const status = statusOf(item)
  if (status === 'used') return `已由 ${item.usedByNickname || '新用户'} 使用`
  if (status === 'expired') return '已过期'
  return '待使用'
}

function formatDate(value: number) {
  return new Date(value).toLocaleString('zh-CN')
}

function remainingText(item: AdminInviteCode) {
  const milliseconds = item.expiresAt - now.value
  if (milliseconds <= 0) return `过期于 ${formatDate(item.expiresAt)}`
  const minutes = Math.ceil(milliseconds / 60000)
  if (minutes < 60) return `${minutes} 分钟后过期`
  const hours = Math.ceil(minutes / 60)
  if (hours < 48) return `${hours} 小时后过期`
  return `${Math.ceil(hours / 24)} 天后过期`
}

onMounted(async () => {
  if (!(await auth.restore())) return router.replace('/login')
  if (!auth.user?.isSuperAdmin) return router.replace('/functions')
  clock = window.setInterval(() => { now.value = Date.now() }, 30000)
  try { await load() } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '邀请码加载失败'
  }
})

onUnmounted(() => {
  if (clock !== undefined) window.clearInterval(clock)
})
</script>

<template>
  <main class="portal-shell">
    <header class="portal-topbar">
      <div class="portal-topbar-start"><BackButton /><RouterLink class="portal-logo" to="/functions"><LogoMark />AutoBuff</RouterLink></div>
      <nav><RouterLink to="/functions">功能中心</RouterLink><RouterLink to="/manual">使用手册</RouterLink><strong>注册邀请码</strong></nav>
    </header>

    <section class="portal-content manage-content">
      <div class="manage-heading">
        <div><p class="portal-kicker">ADMIN</p><h1>注册邀请码</h1><p>邀请码由 6 位字母和数字组成，只能成功注册一次，使用后立即失效。</p></div>
      </div>

      <form class="invite-generator" @submit.prevent="generate">
        <div>
          <strong>生成新邀请码</strong>
          <small>默认有效期为 30 分钟</small>
        </div>
        <label>
          有效时长
          <select v-model="durationChoice">
            <option value="1800">30 分钟（默认）</option>
            <option value="3600">1 小时</option>
            <option value="21600">6 小时</option>
            <option value="86400">1 天</option>
            <option value="604800">7 天</option>
            <option value="custom">自定义</option>
          </select>
        </label>
        <div v-if="durationChoice === 'custom'" class="custom-duration">
          <label>
            数值
            <input v-model.number="customDuration" type="number" min="1" step="1" required>
          </label>
          <label>
            单位
            <select v-model="customUnit"><option value="minutes">分钟</option><option value="hours">小时</option><option value="days">天</option></select>
          </label>
        </div>
        <button :disabled="generating" type="submit">{{ generating ? '生成中…' : '生成邀请码' }}</button>
      </form>

      <p v-if="error" class="inline-notice" role="alert">{{ error }}</p>
      <div v-if="createdCode" class="created-invite">
        <div><small>刚刚生成</small><code>{{ createdCode.code }}</code><span>{{ remainingText(createdCode) }}</span></div>
        <button @click="copyCode(createdCode.code)">{{ copiedCode === createdCode.code ? '已复制' : '复制邀请码' }}</button>
      </div>

      <div class="invite-history-heading"><h2>最近生成</h2><span>最多显示 100 条</span></div>
      <div v-if="inviteCodes.length" class="user-table-wrap">
        <table class="user-table invite-table">
          <thead><tr><th>邀请码</th><th>状态</th><th>有效期</th><th>创建人</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="item in inviteCodes" :key="item.id">
              <td><code>{{ item.code }}</code><small>{{ formatDate(item.createdAt) }} 生成</small></td>
              <td><span class="invite-status" :class="statusOf(item)">{{ statusText(item) }}</span></td>
              <td><strong>{{ remainingText(item) }}</strong><small>{{ formatDate(item.expiresAt) }}</small></td>
              <td>{{ item.createdByNickname }}</td>
              <td class="table-actions">
                <button class="copy-invite-button" @click="copyCode(item.code)">{{ copiedCode === item.code ? '已复制' : '复制' }}</button>
                <button class="danger" :disabled="deletingID === item.id" @click="deleteCode(item)">{{ deletingID === item.id ? '删除中…' : '删除' }}</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-else class="version-empty">还没有生成过邀请码。</div>
    </section>
  </main>
</template>
