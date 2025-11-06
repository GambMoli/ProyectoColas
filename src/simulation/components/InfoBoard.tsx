import React from 'react'
import { Text } from '@react-three/drei'

export default function InfoBoard({ position = [0, 3.2, -8] as [number, number, number], title = 'Departures' }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[8, 2, 0.2]} />
        <meshStandardMaterial color="#111827" metalness={0.4} roughness={0.3} />
      </mesh>
      <Text position={[0, 0.6, 0.11]} fontSize={0.5} color="#93c5fd" anchorX="center" anchorY="middle">{title}</Text>
      <Text position={[0, -0.2, 0.11]} fontSize={0.28} color="#f9fafb" anchorX="center" anchorY="middle">CUC → BOG  08:30  ON TIME</Text>
      <Text position={[0, -0.6, 0.11]} fontSize={0.28} color="#f9fafb" anchorX="center" anchorY="middle">CUC → MDE  09:10  BOARDING</Text>
    </group>
  )
}
