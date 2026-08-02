<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { apiRequest } from '../api/client'
import AnnotationStage from '../components/AnnotationStage.vue'
import BackButton from '../components/BackButton.vue'
import LogoMark from '../components/LogoMark.vue'
import { useAuthStore } from '../stores/auth'
import type { CloudMapSummary } from '../types/api'
import type { MapPayload, Platform, Portal, Rope } from '../types/protocol'

interface MapPackage {
  formatVersion: number
  maps: StoredMapTopology[]
}

interface StoredMapTopology {
  mapName?: string
  referenceWidth?: number
  referenceHeight?: number
  platforms?: Platform[]
  ropes?: Rope[]
  portals?: Portal[]
}

const auth = useAuthStore()
const router = useRouter()
const maps = ref<CloudMapSummary[]>([])
const loading = ref(true)
const selectedFile = ref<File | null>(null)
const uploadInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const busyMapID = ref<number | null>(null)
const error = ref('')
const message = ref('')
const previewDialog = ref<HTMLDialogElement | null>(null)
const previewSummary = ref<CloudMapSummary | null>(null)
const previewPayload = ref<MapPayload | null>(null)
const previewLoading = ref(false)
const previewError = ref('')

async function loadMaps() {
  const response = await apiRequest<{ maps: CloudMapSummary[] }>('/api/admin/maps')
  maps.value = response.maps
}

function selectFile(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null
  error.value = ''
  message.value = ''
}

async function upload() {
  const file = selectedFile.value
  if (!file) return
  if (file.size > 16 * 1024 * 1024) {
    error.value = '地图文件不能超过 16 MB'
    return
  }
  uploading.value = true
  error.value = ''
  message.value = ''
  try {
    const parsed = JSON.parse(await file.text()) as Partial<MapPackage>
    if (parsed.formatVersion !== 1 || !Array.isArray(parsed.maps) || parsed.maps.length === 0) {
      throw new Error('请选择客户端导出的有效地图 JSON 文件')
    }
    const response = await apiRequest<{ uploadedCount: number }>('/api/admin/maps', {
      method: 'POST',
      body: JSON.stringify(parsed),
    })
    message.value = `已上传 ${response.uploadedCount} 张地图；同名地图已覆盖更新。`
    selectedFile.value = null
    if (uploadInput.value) uploadInput.value.value = ''
    await loadMaps()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '地图上传失败'
  } finally {
    uploading.value = false
  }
}

async function downloadMap(map: CloudMapSummary) {
  busyMapID.value = map.id
  error.value = ''
  message.value = ''
  try {
    const data = await apiRequest<MapPackage>(`/api/admin/maps/${map.id}`)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${map.name.replace(/[\\/:*?"<>|]/g, '_')}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    message.value = `已下载“${map.name}”。`
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '地图下载失败'
  } finally {
    busyMapID.value = null
  }
}

async function previewMap(map: CloudMapSummary) {
  previewSummary.value = map
  previewPayload.value = null
  previewError.value = ''
  previewLoading.value = true
  previewDialog.value?.showModal()
  try {
    const data = await apiRequest<MapPackage>(`/api/admin/maps/${map.id}`)
    const topology = data.maps?.[0]
    if (!topology || !Array.isArray(topology.platforms) || !Array.isArray(topology.ropes) || !Array.isArray(topology.portals)) {
      throw new Error('云端地图数据格式无效，无法预览')
    }
    const width = Number(topology.referenceWidth) || 16
    const height = Number(topology.referenceHeight) || 9
    previewPayload.value = {
      id: String(map.id),
      name: topology.mapName || map.name,
      aspectRatio: width > 0 && height > 0 ? width / height : 16 / 9,
      platforms: topology.platforms,
      ropes: topology.ropes,
      portals: topology.portals,
    }
  } catch (caught) {
    previewError.value = caught instanceof Error ? caught.message : '地图预览加载失败'
  } finally {
    previewLoading.value = false
  }
}

async function deleteMap(map: CloudMapSummary) {
  if (!confirm(`确定要删除云端地图“${map.name}”吗？此操作不会删除客户端本地副本。`)) return
  busyMapID.value = map.id
  error.value = ''
  message.value = ''
  try {
    await apiRequest(`/api/admin/maps/${map.id}`, { method: 'DELETE' })
    message.value = `已删除“${map.name}”。`
    await loadMaps()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '地图删除失败'
  } finally {
    busyMapID.value = null
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

onMounted(async () => {
  if (!(await auth.restore())) return router.replace('/login')
  if (!auth.user?.isSuperAdmin) return router.replace('/functions')
  try {
    await loadMaps()
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '云端地图加载失败'
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <main class="portal-shell">
    <header class="portal-topbar">
      <div class="portal-topbar-start"><BackButton /><RouterLink class="portal-logo" to="/functions"><LogoMark />AutoBuff</RouterLink></div>
      <nav><RouterLink to="/functions">功能中心</RouterLink><RouterLink to="/manual">使用手册</RouterLink><RouterLink to="/admin/users">用户管理</RouterLink><strong>地图管理</strong></nav>
    </header>

    <section class="portal-content manage-content">
      <div class="manage-heading map-manage-heading">
        <div><p class="portal-kicker">CLOUD MAPS</p><h1>地图管理</h1><p>管理客户端共享的地图标注文件；上传同名地图时会覆盖云端版本。</p></div>
        <div class="map-upload-panel">
          <label class="map-file-picker">
            <span>{{ selectedFile?.name || '选择地图 JSON' }}</span>
            <input ref="uploadInput" type="file" accept="application/json,.json" @change="selectFile">
          </label>
          <button :disabled="!selectedFile || uploading" @click="upload">{{ uploading ? '上传中…' : '上传到云端' }}</button>
        </div>
      </div>

      <p v-if="error" class="inline-notice">{{ error }}</p>
      <p v-if="message" class="inline-success">{{ message }}</p>

      <div v-if="loading" class="empty-portal"><span>⌁</span><p>正在读取云端地图…</p></div>
      <div v-else-if="!maps.length" class="empty-portal"><span>◇</span><h2>云端还没有地图</h2><p>从客户端导出地图 JSON 后，可在这里上传。</p></div>
      <div v-else class="user-table-wrap">
        <table class="user-table map-table">
          <thead><tr><th>地图名称</th><th>大小</th><th>上传者</th><th>更新时间</th><th>操作</th></tr></thead>
          <tbody>
            <tr v-for="map in maps" :key="map.id">
              <td><strong>{{ map.name }}</strong><small>#{{ map.id }}</small></td>
              <td>{{ formatSize(map.size) }}</td>
              <td>{{ map.uploadedBy }}</td>
              <td>{{ new Date(map.updatedAt).toLocaleString('zh-CN') }}</td>
              <td class="table-actions">
                <button :disabled="busyMapID === map.id" @click="previewMap(map)">预览</button>
                <button :disabled="busyMapID === map.id" @click="downloadMap(map)">下载</button>
                <button class="danger" :disabled="busyMapID === map.id" @click="deleteMap(map)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <dialog ref="previewDialog" class="map-preview-dialog" @close="previewSummary = null; previewPayload = null">
      <header>
        <div><p class="portal-kicker">MAP PREVIEW</p><h2>{{ previewSummary?.name || '地图预览' }}</h2></div>
        <button class="dialog-close" aria-label="关闭" @click="previewDialog?.close()">×</button>
      </header>
      <div v-if="previewLoading" class="dialog-state">正在下载并渲染地图…</div>
      <p v-else-if="previewError" class="inline-notice">{{ previewError }}</p>
      <div v-else-if="previewPayload" class="map-preview-content">
        <div class="map-preview-stage"><AnnotationStage :map="previewPayload" :frame="null" /></div>
        <div class="map-preview-stats">
          <span>平台 <strong>{{ previewPayload.platforms.length }}</strong></span>
          <span>绳索 <strong>{{ previewPayload.ropes.length }}</strong></span>
          <span>传送点 <strong>{{ previewPayload.portals.length }}</strong></span>
        </div>
      </div>
    </dialog>
  </main>
</template>
