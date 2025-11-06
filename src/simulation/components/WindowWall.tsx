import React from 'react'

/** Large window wall to simulate apron view */
export default function WindowWall({ width = 60, height = 4, y = 2.2, z = -30 }: { width?: number; height?: number; y?: number; z?: number }) {
  const frameColor = '#64748b'
  const paneColor = '#bcd4f6'
  const posts: JSX.Element[] = []
  const panes: JSX.Element[] = []
  const cols = 12
  const w = width / cols
  for (let i = 0; i <= cols; i++) {
    const x = -width/2 + i * w
    posts.push(
      <mesh key={'post-'+i} position={[x - width/2 + w/2, y, z]}>
        <boxGeometry args={[0.2, height, 0.2]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
    )
    if (i < cols) {
      const paneX = -width/2 + i * w + w/2
      panes.push(
        <mesh key={'pane-'+i} position={[paneX, y, z]}>
          <boxGeometry args={[w - 0.3, height - 0.4, 0.05]} />
          <meshStandardMaterial color={paneColor} transparent opacity={0.35} roughness={0.05} metalness={0.8} />
        </mesh>
      )
    }
  }
  // simple sky plane outside
  return (
    <group>
      <mesh position={[0, y, z - 2]}>
        <planeGeometry args={[width, height + 6]} />
        <meshStandardMaterial color={"#8ecae6"} />
      </mesh>
      {panes}
      {posts}
      <mesh position={[0, y + height/2 + 0.2, z]}>
        <boxGeometry args={[width, 0.3, 0.2]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
      <mesh position={[0, y - height/2 - 0.2, z]}>
        <boxGeometry args={[width, 0.3, 0.2]} />
        <meshStandardMaterial color={frameColor} />
      </mesh>
    </group>
  )
}
