<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth'

const props = defineProps<{ mode: 'login' | 'register' }>()
const router = useRouter()
const auth = useAuthStore()
const username = ref('')
const password = ref('')
const confirmPassword = ref('')
const inviteCode = ref('')
const error = ref('')
const isRegister = computed(() => props.mode === 'register')

async function submit() {
  error.value = ''
  if (isRegister.value && password.value !== confirmPassword.value) {
    error.value = '两次输入的密码不一致'
    return
  }
  try {
    await auth.authenticate(props.mode, username.value, password.value, inviteCode.value)
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
      <div class="brand-mark">A</div>
      <p class="eyebrow">AUTOBUFF REMOTE</p>
      <h1>纯标注，<br />安全地在远端查看。</h1>
      <p class="brand-copy">原始游戏画面留在本机，云端只传输地图结构和实时坐标。</p>
      <div class="privacy-chip"><span></span> 不上传截图或窗口画面</div>
    </section>

    <section class="auth-panel">
      <form class="auth-card" @submit.prevent="submit">
        <div>
          <p class="eyebrow">{{ isRegister ? 'CREATE ACCOUNT' : 'WELCOME BACK' }}</p>
          <h2>{{ isRegister ? '创建监控账号' : '登录监控账号' }}</h2>
          <p>{{ isRegister ? '使用有效邀请码注册后，即可在 AutoBuff 客户端和控制台登录。' : '登录后进入功能中心，选择需要使用的工具。' }}</p>
        </div>

        <label>
          用户名
          <input v-model.trim="username" autocomplete="username" minlength="3" maxlength="32" required placeholder="字母、数字或下划线" />
        </label>
        <label v-if="isRegister">
          邀请码
          <input v-model.trim="inviteCode" autocomplete="off" maxlength="32" required placeholder="请输入邀请码（不区分大小写）" />
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
        <button class="primary-button" :disabled="auth.loading">
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
