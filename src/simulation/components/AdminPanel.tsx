import React from 'react'
import { Html } from '@react-three/drei'
import { adminStyle, btnStyle } from '../styles/admin'

function ServerCountControl() {
  const bump = (delta: number) => {
    window.dispatchEvent(new CustomEvent('set-server-count-delta', { detail: delta }))
  }
  const set = (val: number) => {
    window.dispatchEvent(new CustomEvent('set-server-count', { detail: val }))
  }
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 8, alignItems: 'center' }}>
      <label>Servidores</label>
      <button onClick={() => bump(-1)} style={btnStyle}>−</button>
      <button onClick={() => bump(+1)} style={btnStyle}>+</button>
      <input
        type="range"
        min={1}
        max={10}
        defaultValue={3}
        onChange={(e) => set(parseInt(e.target.value))}
        style={{ gridColumn: '1 / span 3', width: '100%' }}
      />
    </div>
  )
}

export default function AdminPanel() {
  return (
    <Html fullscreen>
      <div style={adminStyle}>
        <h3 style={{ margin: '0 0 8px 0' }}>Administración</h3>
        <ServerCountControl />
      </div>
    </Html>
  )
}
