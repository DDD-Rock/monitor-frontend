export interface Point {
  x: number
  y: number
}

export interface Platform {
  id: string
  points: Point[]
}

export interface Rope {
  id: string
  x: number
  topY: number
  bottomY: number
}

export interface Portal {
  id: string
  point: Point
  type: 'normal' | 'mapExit' | 'specialEntrance' | 'intraMap'
}

export interface MapPayload {
  id: string
  name: string
  aspectRatio: number
  platforms: Platform[]
  ropes: Rope[]
  portals: Portal[]
}

export interface FramePayload {
  player: Point | null
  teammates: Point[]
  others: Point[]
  sourceFPS: number
  capturedAt: number
}

export interface StatusPayload {
  online: boolean
  message: string
}

export interface EXPPayload {
  currentEXP: number | null
  percent: number | null
  confidence: number | null
  recognitionMethod?: 'ppOCRv4' | 'fixedTemplate'
  status: string
  recognizedAt: number
}

/** 本机对「符文诅咒提示横幅」的识别结果。 */
export interface RunePayload {
  detected: boolean
  confidence: number | null
  detectedAt: number
}

/** 本机对「寻找透明图形」鼠标跟随验证弹窗的识别结果。 */
export interface VerificationPayload {
  detected: boolean
  confidence: number | null
  detectedAt: number
}

/** 归一化的安全区矩形，左上角原点，四个值都在 0~1。 */
export interface ZoneRect {
  x: number
  y: number
  width: number
  height: number
}

/** 本机对「角色是否离开安全区」的判定结果。rect 为空表示安全区已取消。 */
export interface ZonePayload {
  outside: boolean
  rect: ZoneRect | null
  detectedAt: number
}

/**
 * 服务端汇总的经验获取量。
 * 极简模式会伪装成：流入流量 / 流出流量 / 总资源包用量 / 当日资源包用量。
 */
export interface GainPayload {
  inflow10m: number
  outflow1h: number
  totalUsage: number
  dailyUsage: number
  sampledAt: number
}

export interface Envelope<T = unknown> {
  type: 'map' | 'frame' | 'status' | 'exp' | 'rune' | 'verification' | 'zone' | 'gain'
  sequence: number
  payload: T
}

export interface Snapshot {
  type: 'snapshot'
  online: boolean
  map?: MapPayload
  frame?: FramePayload
  status?: StatusPayload
  exp?: EXPPayload
  rune?: RunePayload
  verification?: VerificationPayload
  zone?: ZonePayload
  gain?: GainPayload
  updatedAt: number
}
