import React, { useMemo } from 'react'
import type { SnakeConfig } from '../types'

export default function ZigZagBarriers({ cfg }: { cfg: SnakeConfig }) {
  const postEvery = 2.0
  const beltY = 0.55
  const postColor = '#1a1a1a'
  const beltColor = '#c41e3a'

  const lanes = useMemo(() => {
    const arr: { xCenter: number; zFrom: number; zTo: number }[] = []
    let x = cfg.xLeft
    let z0 = cfg.startZ
    for (let i = 0; i < cfg.segments; i++) {
      const z1 = z0 - cfg.segmentLen
      arr.push({ xCenter: x, zFrom: z0, zTo: z1 })
      z0 = z1
      x = x === cfg.xLeft ? cfg.xRight : cfg.xLeft
    }
    return arr
  }, [cfg])

  const posts: JSX.Element[] = []
  const belts: JSX.Element[] = []

  lanes.forEach((seg, idx) => {
    const xL = seg.xCenter - cfg.corridorWidth / 2
    const xR = seg.xCenter + cfg.corridorWidth / 2
    const len = Math.abs(seg.zTo - seg.zFrom)
    const steps = Math.max(1, Math.floor(len / postEvery))
    for (let i = 0; i <= steps; i++) {
      const z = seg.zFrom + (i / steps) * (seg.zTo - seg.zFrom)
      posts.push(
        <group key={`p-${idx}-${i}`}>
          <mesh position={[xL, 0.5, z]}>
            <cylinderGeometry args={[0.06, 0.1, 1.1, 16]} />
            <meshStandardMaterial color={postColor} roughness={0.3} metalness={0.7} />
          </mesh>
          <mesh position={[xR, 0.5, z]}>
            <cylinderGeometry args={[0.06, 0.1, 1.1, 16]} />
            <meshStandardMaterial color={postColor} roughness={0.3} metalness={0.7} />
          </mesh>
        </group>
      )
      if (i > 0) {
        const zPrev = seg.zFrom + ((i - 1) / steps) * (seg.zTo - seg.zFrom)
        const beltLen = Math.abs(z - zPrev)
        const zMid = (z + zPrev) / 2
        belts.push(
          <group key={`b-${idx}-${i}`}>
            <mesh position={[xL, beltY, zMid]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.05, 0.08, beltLen]} />
              <meshStandardMaterial color={beltColor} roughness={0.6} transparent opacity={0.85} />
            </mesh>
            <mesh position={[xR, beltY, zMid]} rotation={[0, 0, 0]}>
              <boxGeometry args={[0.05, 0.08, beltLen]} />
              <meshStandardMaterial color={beltColor} roughness={0.6} transparent opacity={0.85} />
            </mesh>
          </group>
        )
      }
    }

    if (idx < lanes.length - 1) {
      const next = lanes[idx + 1]
      const zTurn = seg.zTo
      const gap = 0.5
      const xFrom = seg.xCenter + Math.sign(next.xCenter - seg.xCenter) * (cfg.corridorWidth / 2)
      const xTo = next.xCenter - Math.sign(next.xCenter - seg.xCenter) * (cfg.corridorWidth / 2)
      const lenX = Math.abs(xTo - xFrom) - gap * 2
      const xMid = (xFrom + xTo) / 2
      belts.push(
        <mesh key={`cross-top-${idx}`} position={[xMid, beltY, zTurn + 0.3]}>
          <boxGeometry args={[lenX, 0.08, 0.05]} />
          <meshStandardMaterial color={beltColor} roughness={0.6} transparent opacity={0.85} />
        </mesh>
      )
      belts.push(
        <mesh key={`cross-bottom-${idx}`} position={[xMid, beltY, zTurn - 0.3]}>
          <boxGeometry args={[lenX, 0.08, 0.05]} />
          <meshStandardMaterial color={beltColor} roughness={0.6} transparent opacity={0.85} />
        </mesh>
      )
      posts.push(
        <mesh key={`post-turn-L-${idx}`} position={[xFrom, 0.5, zTurn]}>
          <cylinderGeometry args={[0.06, 0.1, 1.1, 16]} />
          <meshStandardMaterial color={postColor} />
        </mesh>
      )
      posts.push(
        <mesh key={`post-turn-R-${idx}`} position={[xTo, 0.5, zTurn]}>
          <cylinderGeometry args={[0.06, 0.1, 1.1, 16]} />
          <meshStandardMaterial color={postColor} />
        </mesh>
      )
    }
  })

  return <group>{posts}{belts}</group>
}
