import React from 'react'

export default function AirportFloor() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[60, 60]} />
        <meshStandardMaterial color="#e8dcc4" roughness={0.2} metalness={0.15} />
      </mesh>
      {[-20, -10, 10, 20].map((z, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.005, z]}>
          <planeGeometry args={[40, 0.08]} />
          <meshStandardMaterial color="#c4b5a0" roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}
