import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { apiRequest, getAccessToken, setAccessToken } from '../api/client'
import type { AuthResponse, User } from '../types/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const loading = ref(false)
  const authenticated = computed(() => Boolean(user.value && getAccessToken()))

  async function authenticate(
    mode: 'login' | 'register',
    username: string,
    password: string,
    inviteCode = '',
  ) {
    loading.value = true
    try {
      const response = await apiRequest<AuthResponse>(`/api/auth/${mode}`, {
        method: 'POST',
        body: JSON.stringify(
          mode === 'register'
            ? { username, password, inviteCode }
            : { username, password },
        ),
      })
      setAccessToken(response.accessToken, response.expiresAt)
      user.value = response.user
      return response
    } finally {
      loading.value = false
    }
  }

  async function restore(): Promise<boolean> {
    if (!getAccessToken()) return false
    try {
      user.value = await apiRequest<User>('/api/auth/me')
      return true
    } catch {
      logout()
      return false
    }
  }

  function logout() {
    setAccessToken(null)
    user.value = null
  }

  return { user, loading, authenticated, authenticate, restore, logout }
})
