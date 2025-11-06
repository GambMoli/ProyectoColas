import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'

export default function Passenger({
  position,
  inService
}: {
  position: [number, number, number]
  inService: boolean
}) {
  const ref = useRef<Group>(null!)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    const [x, baseY, z] = position
    const bob = inService ? 0 : Math.sin(t * 2 + z) * 0.02
    ref.current.position.set(x, baseY + bob, z)
  })

  return (
    <group ref={ref}>
      <mesh position={[0, 0.5, 0]} castShadow>
        <capsuleGeometry args={[0.18, 0.65, 8, 16]} />
        <meshStandardMaterial color="#3b82f6" roughness={0.7} />
      </mesh>
      <mesh position={[0, 1.1, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>
      <mesh position={[0.35, 0.25, 0]} rotation={[0, 0, 0.1]} castShadow>
        <boxGeometry args={[0.3, 0.4, 0.18]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0.35, 0.5, 0]}>
        <torusGeometry args={[0.08, 0.02, 8, 16, Math.PI]} />
        <meshStandardMaterial color="#374151" />
      </mesh>
    </group>
  )
}
