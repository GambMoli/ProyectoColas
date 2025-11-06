import React from 'react'
import { Text } from '@react-three/drei'

export default function OverheadSignage({ center = [0, 7, -5] as [number, number, number] }) {
  return (
    <group position={center}>
      <mesh>
        <boxGeometry args={[4.5, 0.8, 0.1]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.4} metalness={0.3} />
      </mesh>
      <Text position={[0, 0, 0.08]} fontSize={0.35} color="#ffffff" anchorX="center" anchorY="middle">
        MIGRACIÓN · MIGRATION
      </Text>
      <mesh position={[0, -0.5, 0.08]}>
        <boxGeometry args={[0.4, 0.4, 0.02]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={0.3} />
      </mesh>
    </group>
  )
}
