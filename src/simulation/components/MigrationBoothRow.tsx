import React, { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'

export default function MigrationBoothRow({
  count,
  boothSpacing,
  serviceZ,
  standZ,
  occupied
}: {
  count: number
  boothSpacing: number
  serviceZ: number
  standZ: number
  occupied: boolean[]
}) {
  const startX = -((count - 1) * boothSpacing) / 2
  return (
    <group>
      {Array.from({ length: count }).map((_, i) => {
        const x = startX + i * boothSpacing
        return (
          <MigrationBooth
            key={i}
            position={[x, 0, serviceZ]}
            hasPassenger={occupied[i]}
            standZ={standZ}
          />
        )
      })}
    </group>
  )
}

function MigrationBooth({ position, hasPassenger, standZ }: { position: [number, number, number]; hasPassenger: boolean; standZ: number }) {
  return (
    <group position={position}>
      <mesh position={[0, 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[2.2, 1.0, 1.6]} />
        <meshStandardMaterial color="#c41e3a" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[0, 1.05, 0]} castShadow>
        <boxGeometry args={[2.2, 0.1, 1.6]} />
        <meshStandardMaterial color="#2d3748" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 1.8, 0.1]}>
        <boxGeometry args={[2.0, 1.4, 0.08]} />
        <meshStandardMaterial color="#b0c4de" transparent opacity={0.3} roughness={0.1} metalness={0.8} />
      </mesh>
      <mesh position={[0, 1.8, 0.1]}>
        <boxGeometry args={[2.05, 1.45, 0.05]} />
        <meshStandardMaterial color="#4a5568" roughness={0.4} metalness={0.6} wireframe />
      </mesh>
      <mesh position={[0, 1.3, 0.15]}>
        <boxGeometry args={[1.0, 0.3, 0.02]} />
        <meshStandardMaterial color="#1a202c" transparent opacity={0.8} />
      </mesh>
      <group position={[0.4, 1.15, -0.3]}>
        <mesh castShadow>
          <boxGeometry args={[0.5, 0.35, 0.05]} />
          <meshStandardMaterial color="#1a202c" metalness={0.5} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0, -0.03]}>
          <boxGeometry args={[0.45, 0.3, 0.01]} />
          <meshStandardMaterial color="#2563eb" emissive="#1e40af" emissiveIntensity={0.3} />
        </mesh>
      </group>
      <mesh position={[-0.5, 1.12, 0.4]} castShadow>
        <boxGeometry args={[0.25, 0.08, 0.35]} />
        <meshStandardMaterial color="#374151" metalness={0.4} roughness={0.5} />
      </mesh>
      <MigrationOfficer position={[0, 1.1, -0.5]} isWorking={hasPassenger} />
      <mesh position={[0, 0.01, standZ - position[2]]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.35, 24]} />
        <meshStandardMaterial color="#22c55e" transparent opacity={hasPassenger ? 0.2 : 0.08} />
      </mesh>
    </group>
  )
}

function MigrationOfficer({ position, isWorking }: { position: [number, number, number]; isWorking: boolean }) {
  const ref = useRef<Group>(null!)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.y = isWorking ? Math.sin(t * 1.2) * 0.15 : 0
  })
  return (
    <group ref={ref} position={position}>
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.22, 0.25, 0.7, 16]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
      <mesh position={[0, 0.95, 0]} castShadow>
        <sphereGeometry args={[0.18, 16, 16]} />
        <meshStandardMaterial color="#d4a574" />
      </mesh>
      <group position={[0, 1.1, 0]}>
        <mesh castShadow>
          <cylinderGeometry args={[0.19, 0.16, 0.08, 16]} />
          <meshStandardMaterial color="#1e3a8a" />
        </mesh>
        <mesh position={[0, 0.05, 0.12]}>
          <boxGeometry args={[0.25, 0.02, 0.15]} />
          <meshStandardMaterial color="#1e3a8a" />
        </mesh>
      </group>
      <mesh position={[-0.3, 0.3, 0]} rotation={[0, 0, 0.3]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
      <mesh position={[0.3, 0.3, 0]} rotation={[0, 0, -0.3]} castShadow>
        <cylinderGeometry args={[0.08, 0.08, 0.5, 8]} />
        <meshStandardMaterial color="#1e40af" />
      </mesh>
    </group>
  )
}
