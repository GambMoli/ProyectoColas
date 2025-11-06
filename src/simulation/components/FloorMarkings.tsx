import React from 'react'

export default function FloorMarkings() {
  const marks: JSX.Element[] = []
  // yellow guidance lines to booths
  for (let i = -8; i <= 8; i += 4) {
    marks.push(
      <mesh key={'g-'+i} rotation={[-Math.PI/2,0,0]} position={[i, 0.011, -1]}>
        <planeGeometry args={[0.08, 6]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    )
  }
  // arrows
  for (let i = -8; i <= 8; i += 8) {
    marks.push(
      <mesh key={'a-'+i} rotation={[-Math.PI/2,0,0]} position={[i, 0.012, -5]}>
        <coneGeometry args={[0.35, 0.8, 16]} />
        <meshStandardMaterial color="#fbbf24" />
      </mesh>
    )
  }
  return <group>{marks}</group>
}
