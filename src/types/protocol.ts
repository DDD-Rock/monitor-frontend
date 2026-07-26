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

export interface Envelope<T = unknown> {
  type: 'map' | 'frame' | 'status'
  sequence: number
  payload: T
}

export interface Snapshot {
  type: 'snapshot'
  online: boolean
  map?: MapPayload
  frame?: FramePayload
  status?: StatusPayload
  updatedAt: number
}
