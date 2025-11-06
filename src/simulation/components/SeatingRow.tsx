import React from 'react'

export default function SeatingRow({ seats = 8, x = 0, z = -15, rotationY = 0 }: { seats?: number; x?: number; z?: number; rotationY?: number }) {
  const elems: JSX.Element[] = []
  const seatW = 0.6
  const gap = 0.15
  const total = seats * (seatW + gap) - gap
  const start = -total / 2 + seatW / 2
  for (let i = 0; i < seats; i++) {
    const sx = start + i * (seatW + gap)
    elems.push(
      <group key={i} position={[sx, 0, 0]}>
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[seatW, 0.05, 0.5]} />
          <meshStandardMaterial color="#1f2937" metalness={0.4} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.5, -0.2]}>
          <boxGeometry args={[seatW, 0.5, 0.05]} />
          <meshStandardMaterial color="#111827" />
        </mesh>
        <mesh position={[0, 0.1, 0.22]}>
          <boxGeometry args={[seatW, 0.2, 0.05]} />
          <meshStandardMaterial color="#6b7280" />
        </mesh>
      </group>
    )
  }
  return <group position={[x, 0, z]} rotation={[0, rotationY, 0]}>{elems}</group>
}
