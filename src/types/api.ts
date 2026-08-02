export interface User {
  id: number
  nickname: string
  isSuperAdmin: boolean
}

export interface ManagedClient {
  id: string
  clientId: string
  name: string
  roleName: string
  mode: 'dead' | 'live' | 'temple' | 'follow_heal' | 'monitor'
  running: boolean
  online: boolean
  createdAt: number
  lastSeenAt: number | null
}

export interface RopeTeamMember {
  sessionId: string
  clientId: string
  name: string
  roleName: string
  isLeader: boolean
  joined: boolean
  online: boolean
}

export interface RopeTeam {
  id: number
  leaderSessionId: string
  members: RopeTeamMember[]
}

export interface AdminUser {
  id: number
  nickname: string
  status: 0 | 1
  isSuperAdmin: boolean
  createdAt: number
  lastLoginAt: number | null
  connectedClientCount: number
  maxClientCount: number
}

export interface AdminInviteCode {
  id: number
  code: string
  createdAt: number
  expiresAt: number
  usedAt: number | null
  createdByNickname: string
  usedByNickname?: string
}

export interface AuthResponse {
  accessToken: string
  expiresAt: number
  user: User
}

export interface CloudMapSummary {
  id: number
  name: string
  size: number
  updatedAt: number
  uploadedBy: string
}

export interface ClientVersionPolicy {
  platform: 'macos' | 'windows'
  version: string
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface ApiError {
  error: string
  message: string
}

export interface BarkSettings {
  configured: boolean
  urgentAlertsMuted: boolean
  expStalledEnabled: boolean
  expStalledSeconds: number
  runeAlertEnabled: boolean
  runeAlertIntervalSeconds: number
  mouseFollowVerificationEnabled: boolean
  mouseFollowVerificationIntervalSeconds: number
  zoneBreachEnabled: boolean
  zoneBreachIntervalSeconds: number
  barkServerURL: string
}
