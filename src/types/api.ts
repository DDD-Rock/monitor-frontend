export interface User {
  id: number
  username: string
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
