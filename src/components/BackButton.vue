<script setup lang="ts">
import { useRouter } from 'vue-router'

const props = withDefaults(defineProps<{
  fallback?: string
  label?: string
}>(), {
  fallback: '/functions',
  label: '返回',
})

const router = useRouter()

function goBack() {
  const previousPath = window.history.state?.back
  const hasUsefulHistory = typeof previousPath === 'string'
    && previousPath !== '/login'
    && previousPath !== '/register'

  if (hasUsefulHistory) {
    router.back()
    return
  }

  router.push(props.fallback)
}
</script>

<template>
  <button class="back-button" type="button" :aria-label="`${label}上一页`" @click="goBack">
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M15.5 10H4.5m0 0 4.25-4.25M4.5 10l4.25 4.25" />
    </svg>
    <span>{{ label }}</span>
  </button>
</template>
