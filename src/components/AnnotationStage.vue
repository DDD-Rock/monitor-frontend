<script setup lang="ts">
import { computed } from 'vue'
import type { FramePayload, MapPayload, Point } from '../types/protocol'

const props = defineProps<{ map: MapPayload | null; frame: FramePayload | null }>()
const viewWidth = 1200
const viewHeight = computed(() => Math.round(viewWidth / (props.map?.aspectRatio || 16 / 9)))
const point = (value: Point) => `${value.x * viewWidth},${value.y * viewHeight.value}`
</script>

<template>
  <svg class="annotation-stage" :viewBox="`0 0 ${viewWidth} ${viewHeight}`" role="img" :aria-label="map ? `${map.name} 实时标注` : '实时标注画布'">
    <defs>
      <radialGradient id="stageGlow">
        <stop offset="0" stop-color="#16233f" />
        <stop offset="1" stop-color="#080c15" />
      </radialGradient>
      <filter id="markerGlow"><feGaussianBlur stdDeviation="7" /></filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#stageGlow)" />
    <g class="grid-lines">
      <line v-for="n in 9" :key="`v${n}`" :x1="n * viewWidth / 10" y1="0" :x2="n * viewWidth / 10" :y2="viewHeight" />
      <line v-for="n in 5" :key="`h${n}`" x1="0" :y1="n * viewHeight / 6" :x2="viewWidth" :y2="n * viewHeight / 6" />
    </g>

    <g v-if="map">
      <g v-for="(platform, index) in map.platforms" :key="platform.id">
        <polyline class="platform-line" :points="platform.points.map(point).join(' ')" />
        <text v-if="platform.points.length" class="map-label platform-label" :x="platform.points[Math.floor(platform.points.length / 2)].x * viewWidth" :y="platform.points[Math.floor(platform.points.length / 2)].y * viewHeight - 18">P{{ index + 1 }}</text>
      </g>
      <g v-for="(rope, index) in map.ropes" :key="rope.id">
        <line class="rope-line" :x1="rope.x * viewWidth" :x2="rope.x * viewWidth" :y1="rope.topY * viewHeight" :y2="rope.bottomY * viewHeight" />
        <text class="map-label rope-label" :x="rope.x * viewWidth + 15" :y="((rope.topY + rope.bottomY) / 2) * viewHeight">R{{ index + 1 }}</text>
      </g>
      <g v-for="(portal, index) in map.portals" :key="portal.id">
        <circle class="portal-ring" :cx="portal.point.x * viewWidth" :cy="portal.point.y * viewHeight" r="11" />
        <circle class="portal-dot" :cx="portal.point.x * viewWidth" :cy="portal.point.y * viewHeight" r="6" />
        <rect class="portal-square" :x="portal.point.x * viewWidth - 8" :y="portal.point.y * viewHeight - 8" width="16" height="16" />
        <text class="map-label portal-label" :x="portal.point.x * viewWidth + 17" :y="portal.point.y * viewHeight + 4">T{{ index + 1 }}</text>
      </g>
    </g>

    <g v-if="frame">
      <g v-for="(marker, index) in frame.teammates" :key="`team-${index}`">
        <circle class="marker-shadow" :cx="marker.x * viewWidth" :cy="marker.y * viewHeight" r="13" />
        <circle class="teammate-marker" :cx="marker.x * viewWidth" :cy="marker.y * viewHeight" r="8" />
      </g>
      <g v-for="(marker, index) in frame.others" :key="`other-${index}`">
        <circle class="marker-shadow" :cx="marker.x * viewWidth" :cy="marker.y * viewHeight" r="13" />
        <circle class="other-marker" :cx="marker.x * viewWidth" :cy="marker.y * viewHeight" r="8" />
      </g>
      <g v-if="frame.player">
        <circle class="player-glow" :cx="frame.player.x * viewWidth" :cy="frame.player.y * viewHeight" r="25" />
        <circle class="marker-shadow" :cx="frame.player.x * viewWidth" :cy="frame.player.y * viewHeight" r="15" />
        <circle class="player-marker" :cx="frame.player.x * viewWidth" :cy="frame.player.y * viewHeight" r="9" />
        <path class="player-arrow" :d="`M ${frame.player.x * viewWidth - 9} ${frame.player.y * viewHeight - 31} L ${frame.player.x * viewWidth + 9} ${frame.player.y * viewHeight - 31} L ${frame.player.x * viewWidth} ${frame.player.y * viewHeight - 18} Z`" />
      </g>
    </g>
  </svg>
</template>
