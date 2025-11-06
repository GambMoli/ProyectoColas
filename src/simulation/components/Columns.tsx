import React from 'react'

export default function Columns({ radius = 0.35, height = 6, step = 10, inset = 3, area = 60 }: { radius?: number; height?: number; step?: number; inset?: number; area?: number }) {
  const half = area / 2 - inset
  const color = '#94a3b8'
  const arr: JSX.Element[] = []
  let key = 0
  for (let x = -half; x <= half; x += step) {
    for (let z = -half; z <= half; z += step) {
      // perimeter ring feel
      if (Math.abs(x) === half || Math.abs(z) === half) {
        arr.push(
          <mesh key={key++} position={[x, height/2, z]} castShadow>
            <cylinderGeometry args={[radius, radius, height, 16]} />
            <meshStandardMaterial color={color} roughness={0.6} metalness={0.2} />
          </mesh>
        )
      }
    }
  }
  return <group>{arr}</group>
}
