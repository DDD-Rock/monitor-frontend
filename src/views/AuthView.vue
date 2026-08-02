<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import LogoMark from '../components/LogoMark.vue'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{ mode: 'login' | 'register' }>()
const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const nickname = ref('')
const password = ref('')
const confirmPassword = ref('')
const inviteCode = ref('')
const error = ref('')
const authForm = ref<HTMLFormElement | null>(null)
const isRegister = computed(() => props.mode === 'register')

function submitOnEnter(event: KeyboardEvent) {
  if (event.isComposing || auth.loading) return
  event.preventDefault()
  authForm.value?.requestSubmit()
}

async function submit() {
  error.value = ''
  if (isRegister.value && password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  try {
    await auth.authenticate(props.mode, username.value, password.value, inviteCode.value, nickname.value)
    const redirect = typeof router.currentRoute.value.query.redirect === 'string'
      ? router.currentRoute.value.query.redirect
      : '/functions'
    await router.replace(redirect)
  } catch (caught) {
    error.value = caught instanceof Error ? caught.message : '请求失败，请稍后重试'
  }
}
</script>

<template>
  <main class="auth-shell">
    <section class="auth-brand">
      <LogoMark class="brand-mark" />
      <p class="eyebrow">AUTOBUFF CONTROL CENTER</p>
      <h1>客户端与云端，<br />协同完成每一次操作。</h1>
      <p class="brand-copy">统一连接 AutoBuff 客户端与网页控制台，集中承载远程监控、设备管理、地图共享、版本控制，以及持续扩展的协同能力。</p>
      <div class="privacy-chip"><span></span> 网页控制台与客户端实时协同</div>
    </section>

    <section class="auth-panel">
      <form ref="authForm" class="auth-card" @submit.prevent="submit" @keydown.enter="submitOnEnter">
        <div>
          <p class="eyebrow">{{ isRegister ? 'CREATE ACCOUNT' : 'WELCOME BACK' }}</p>
          <h2>{{ isRegister ? '创建监控账号' : '登录监控账号' }}</h2>
          <p>{{ isRegister ? '使用有效邀请码创建统一账号，在客户端与网页控制台使用同一身份。' : '登录统一控制台，连接客户端并使用完整的云端管理与交互功能。' }}</p>
        </div>

        <label>
          用户名
          <input v-model.trim="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="字母、数字或下划线" />
        </label>
        <label v-if="isRegister">
          昵称
          <input v-model.trim="nickname" autocomplete="nickname" minlength="1" maxlength="24" required placeholder="网页和客户端展示的名称" />
        </label>
        <label v-if="isRegister">
          邀请码
          <input v-model.trim="inviteCode" autocomplete="off" minlength="6" maxlength="6" pattern="[A-Za-z0-9]{6}" required placeholder="6 位字母或数字" />
        </label>
        <label>
          密码
          <input v-model="password" :autocomplete="isRegister ? 'new-password' : 'current-password'" type="password" minlength="8" maxlength="72" required placeholder="至少 8 位" />
        </label>
        <label v-if="isRegister">
          确认密码
          <input v-model="confirmPassword" autocomplete="new-password" type="password" required placeholder="再次输入密码" />
        </label>

        <p v-if="error" class="form-error" role="alert">{{ error }}</p>
        <button class="primary-button" type="submit" :disabled="auth.loading">
          {{ auth.loading ? '请稍候…' : isRegister ? '创建账号' : '登录' }}
        </button>

        <p class="auth-switch">
          {{ isRegister ? '已有账号？' : '还没有账号？' }}
          <RouterLink :to="isRegister ? '/login' : '/register'">
            {{ isRegister ? '返回登录' : '立即注册' }}
          </RouterLink>
        </p>
      </form>
    </section>
  </main>
</template>
