// src/MigrationControlSim.tsx
import React, { useState } from 'react'
import { Canvas } from '@react-three/fiber'
import Simulation from './Simulation'
import type { SimParams } from './types'
import ExcelSetupOverlay, { Derived as ExcelDerived } from './components/ExcelSetupOverlay'

export default function MigrationControlSim() {
  const [resetVersion, setResetVersion] = useState(0)
  const [params, setParams] = useState<SimParams | null>(null)

  const defaultSimSpeed = 1
  const defaultSpacing = 1.8
  const defaultSlaTarget = 15

  const startWithExcel = (d: ExcelDerived) => {
    console.log('[MigrationControlSim] startWithExcel ->', d)

    const p: SimParams = {
      lambdaPerMin: d.lambdaPerMin,
      serviceMeanSec: d.serviceMeanSec,
      serviceCV: d.serviceCV,
      simSpeed: defaultSimSpeed,
      spacing: defaultSpacing,
      slaTarget: defaultSlaTarget,
      serverCount: 1,
      // cronograma exacto (si viene del Excel)
      arrivalsSec: d.arrivalsSec,
      serviceTimesSec: d.serviceTimesSec
    }

    setParams(p)
    setResetVersion(v => v + 1)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#e5e5e5' }}>
      {!params && <ExcelSetupOverlay onReady={startWithExcel} />}

      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [18, 14, 24], fov: 50 }}
      >
        {params && <Simulation params={params} resetVersion={resetVersion} />}
      </Canvas>
    </div>
  )
}
