import React from 'react'

export default function PerimeterWalls({ size = 60, height = 3, thickness = 0.35 }: { size?: number; height?: number; thickness?: number }) {
  const half = size / 2
  const h = height
  const t = thickness
  const color = '#cbd5e1'
  return (
    <group>
      <mesh position={[0, h / 2, -half + t / 2]}>
        <boxGeometry args={[size, h, t]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[0, h / 2, half - t / 2]}>
        <boxGeometry args={[size, h, t]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[-half + t / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, size]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      <mesh position={[half - t / 2, h / 2, 0]}>
        <boxGeometry args={[t, h, size]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
    </group>
  )
}
