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
  status: string
  recognizedAt: number
}

/** 本机对「符文诅咒提示横幅」的识别结果。 */
export interface RunePayload {
  detected: boolean
  confidence: number | null
  detectedAt: number
}

export interface Envelope<T = unknown> {
  type: 'map' | 'frame' | 'status' | 'exp' | 'rune'
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
  updatedAt: number
}
