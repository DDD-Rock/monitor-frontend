export interface User {
  id: number
  username: string
}

export interface AuthResponse {
  accessToken: string
  expiresAt: number
  user: User
}

export interface MonitorSession {
  id: string
  name: string
  createdAt?: number
}

export interface CreatedMonitorSession extends MonitorSession {
  previewToken: string
  previewURL: string
  publishURL: string
}

export interface ApiError {
  error: string
  message: string
}
