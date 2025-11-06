import React, { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Group } from 'three'

type Props = {
  position: [number, number, number]
  inService: boolean
  shirt?: string
  pants?: string
  skin?: string
  accessory?: string
}

export default function StylizedPassenger({ position, inService, shirt = '#2563eb', pants = '#1f2937', skin = '#d4a574', accessory = '#374151' }: Props) {
  const ref = useRef<Group>(null!)
  const leftArm = useRef<Group>(null!)
  const rightArm = useRef<Group>(null!)
  const leftLeg = useRef<Group>(null!)
  const rightLeg = useRef<Group>(null!)

  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    // subtle idle bounce
    ref.current.position.y = inService ? 0 : Math.sin(t * 2 + ref.current.position.z) * 0.02
    // walk cycle for queue (arm/leg swing)
    const swing = inService ? 0.1 : 0.35
    const phase = t * 2.2 + ref.current.position.z * 0.25
    if (leftArm.current && rightArm.current && leftLeg.current && rightLeg.current) {
      leftArm.current.rotation.x = Math.sin(phase) * swing
      rightArm.current.rotation.x = Math.sin(phase + Math.PI) * swing
      leftLeg.current.rotation.x = Math.sin(phase + Math.PI) * swing * 0.7
      rightLeg.current.rotation.x = Math.sin(phase) * swing * 0.7
    }
  })

  // Sizes
  const torsoH = 0.6, torsoW = 0.35, torsoD = 0.22
  const legH = 0.5, legW = 0.14, legD = 0.14
  const armH = 0.45, armW = 0.12, armD = 0.12

  return (
    <group ref={ref} position={position}>
      {/* legs */}
      <group ref={leftLeg} position={[-legW/2 - 0.03, legH/2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[legW, legH, legD]} />
          <meshStandardMaterial color={pants} />
        </mesh>
      </group>
      <group ref={rightLeg} position={[legW/2 + 0.03, legH/2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[legW, legH, legD]} />
          <meshStandardMaterial color={pants} />
        </mesh>
      </group>

      {/* torso */}
      <mesh position={[0, legH + torsoH/2, 0]} castShadow>
        <boxGeometry args={[torsoW, torsoH, torsoD]} />
        <meshStandardMaterial color={shirt} roughness={0.6} />
      </mesh>

      {/* head */}
      <mesh position={[0, legH + torsoH + 0.18, 0]} castShadow>
        <sphereGeometry args={[0.16, 16, 16]} />
        <meshStandardMaterial color={skin} />
      </mesh>
      {/* simple face */}
      <mesh position={[-0.06, legH + torsoH + 0.18, 0.14]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>
      <mesh position={[0.06, legH + torsoH + 0.18, 0.14]}>
        <sphereGeometry args={[0.02, 8, 8]} />
        <meshStandardMaterial color="#111827" />
      </mesh>

      {/* arms */}
      <group ref={leftArm} position={[-torsoW/2 - armW/2, legH + torsoH - armH/2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[armW, armH, armD]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
      </group>
      <group ref={rightArm} position={[torsoW/2 + armW/2, legH + torsoH - armH/2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[armW, armH, armD]} />
          <meshStandardMaterial color={shirt} />
        </mesh>
      </group>

      {/* backpack */}
      <mesh position={[0, legH + torsoH/2, -torsoD/2 - 0.05]} castShadow>
        <boxGeometry args={[torsoW * 0.8, torsoH * 0.8, 0.12]} />
        <meshStandardMaterial color={accessory} roughness={0.4} metalness={0.2} />
      </mesh>
    </group>
  )
}
