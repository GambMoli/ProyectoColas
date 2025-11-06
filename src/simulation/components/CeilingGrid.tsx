import React from 'react'

export default function CeilingGrid({ width = 60, depth = 60, y = 6, cell = 3 }: { width?: number; depth?: number; y?: number; cell?: number }) {
  const panels: JSX.Element[] = []
  const halfW = width / 2
  const halfD = depth / 2
  let key = 0
  for (let x = -halfW; x < halfW; x += cell) {
    for (let z = -halfD; z < halfD; z += cell) {
      panels.push(
        <group key={key++} position={[x + cell / 2, y, z + cell / 2]}>
          {/* light panel */}
          <mesh>
            <boxGeometry args={[cell - 0.4, 0.05, cell - 0.4]} />
            <meshStandardMaterial color="#e2e8f0" emissive="#f1f5f9" emissiveIntensity={0.08} roughness={0.9} />
          </mesh>
          {/* frame */}
          <mesh>
            <boxGeometry args={[cell - 0.2, 0.03, cell - 0.2]} />
            <meshStandardMaterial color="#94a3b8" transparent opacity={0.15} />
          </mesh>
        </group>
      )
    }
  }
  return <group>{panels}</group>
}
