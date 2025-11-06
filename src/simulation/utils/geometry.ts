import type { SnakeConfig } from '../types'

export function length3(a: [number, number, number], b: [number, number, number]) {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2]
  return Math.sqrt(dx*dx + dy*dy + dz*dz)
}

export function lerp3(a: [number, number, number], b: [number, number, number], t: number) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ] as [number, number, number]
}

export function samplePolyline(points: [number, number, number][], dist: number): [number, number, number] {
  if (points.length < 2) return points[0] || [0,0,0]
  let total = 0
  const segLens: number[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const L = length3(points[i], points[i+1])
    segLens.push(L)
    total += L
  }
  if (total === 0) return points[0]

  const D = Math.max(0, Math.min(dist, total - 1e-6))
  let acc = 0
  for (let i = 0; i < segLens.length; i++) {
    const L = segLens[i]
    if (D <= acc + L) {
      const t = (D - acc) / L
      return lerp3(points[i], points[i+1], t)
    }
    acc += L
  }
  return points[points.length - 1]
}

export function buildSnakePath(cfg: SnakeConfig): [number, number, number][] {
  const pts: [number, number, number][] = []
  let x = cfg.xLeft
  let z = cfg.startZ
  pts.push([x, 0, z])

  for (let i = 0; i < cfg.segments; i++) {
    z -= cfg.segmentLen
    pts.push([x, 0, z])
    if (i < cfg.segments - 1) {
      x = x === cfg.xLeft ? cfg.xRight : cfg.xLeft
      pts.push([x, 0, z])
    }
  }
  return pts
}
