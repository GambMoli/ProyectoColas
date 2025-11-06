export type Passenger = {
  id: number
  state: 'queue' | 'service' | 'done'
  pos: [number, number, number]
  arrivalAt: number
  serviceStartAt?: number
  serviceEndAt?: number
  serverIdx?: number

  appearance?: {
    shirt: string
    pants: string
    skin: string
    accessory?: string
  }
}

export type SimParams = {
  lambdaPerMin: number
  serviceMeanSec: number
  serviceCV: number
  simSpeed: number
  spacing: number
  slaTarget: number
  serverCount: number
    arrivalsSec?: number[]
  serviceTimesSec?: number[]
}

export type SnakeConfig = {
  segments: number
  segmentLen: number
  xLeft: number
  xRight: number
  startZ: number
  corridorWidth: number
}
