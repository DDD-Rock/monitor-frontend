export interface User {
  id: number
  username: string
  isSuperAdmin: boolean
}

export interface ManagedClient {
  id: string
  clientId: string
  name: string
  mode: 'dead' | 'live' | 'follow_heal' | 'monitor'
  running: boolean
  online: boolean
  lastSeenAt: number | null
}

export interface AdminUser {
  id: number
  username: string
  status: 0 | 1
  isSuperAdmin: boolean
  createdAt: number
  lastLoginAt: number | null
  connectedClientCount: number
}

export interface AuthResponse {
  accessToken: string
  expiresAt: number
  user: User
}

export interface ApiError {
  error: string
  message: string
}

export interface BarkSettings {
  configured: boolean
  expStalledEnabled: boolean
  expStalledSeconds: number
  runeAlertEnabled: boolean
  runeAlertIntervalSeconds: number
  zoneBreachEnabled: boolean
  zoneBreachIntervalSeconds: number
  barkServerURL: string
}
