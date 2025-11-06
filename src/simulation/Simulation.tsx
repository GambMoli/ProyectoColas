import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { OrbitControls, Html } from '@react-three/drei'

import type { Passenger, SimParams, SnakeConfig } from './types'
import { expSample, lognormalSample } from './utils/distributions'
import { buildSnakePath, lerp3, samplePolyline } from './utils/geometry'

import AirportFloor from './components/AirportFloor'
import PerimeterWalls from './components/PerimeterWalls'
import OverheadSignage from './components/OverheadSignage'
import CeilingGrid from './components/CeilingGrid'
import WindowWall from './components/WindowWall'
import Columns from './components/Columns'
import SeatingRow from './components/SeatingRow'
import InfoBoard from './components/InfoBoard'
import FloorMarkings from './components/FloorMarkings'
import ZigZagBarriers from './components/ZigZagBarriers'
import MigrationBoothRow from './components/MigrationBoothRow'
import PassengerMesh from './components/StylizedPassenger'
import HUD from './components/HUD'

export default function Simulation({ params, resetVersion }: { params: SimParams; resetVersion: number }) {
  const {
    lambdaPerMin,
    serviceMeanSec,
    serviceCV,
    simSpeed,
    spacing,
    slaTarget,
    serverCount,
    arrivalsSec,
    serviceTimesSec
  } = params

  const arrivalsSchedule = arrivalsSec
  const serviceTimesSchedule = serviceTimesSec
  const hasSchedule = !!(arrivalsSchedule && arrivalsSchedule.length > 0)

  // -------- Estado visible en React --------
  const [passengers, setPassengers] = useState<Passenger[]>([])
  const [completed, setCompleted] = useState<number>(0)
  const [avgWait, setAvgWait] = useState<number>(0)
  const [waitTimes, setWaitTimes] = useState<number[]>([])

  const [paused, setPaused] = useState(false)
  const [showConclusion, setShowConclusion] = useState(false)
  const [autoConclusionShown, setAutoConclusionShown] = useState(false)

  // HUD en vivo
  const [simClockSec, setSimClockSec] = useState(0)
  const [timeToNextArrival, setTimeToNextArrival] = useState<number | null>(null)
  const [serviceRemaining, setServiceRemaining] = useState<number[]>([])

  // -------- Estado interno de simulación (refs) --------
  const simTime = useRef(0)
  const nextArrivalAt = useRef(0)
  const busyUntil = useRef<(number | null)[]>([])
  const totalWait = useRef(0)
  const scheduleIdx = useRef(0)

  // Lista "real" de pasajeros (se muta en el loop)
  const passengersRef = useRef<Passenger[]>([])

  // Mantener ref sincronizada cuando cambia el estado (no crítico, pero útil)
  useEffect(() => {
    passengersRef.current = passengers
  }, [passengers])

  // Geometría cabinas y cola
  const boothSpacing = 4.0
  const serviceZ = 0
  const standZ = -1.1

  const servicePositions = useMemo<[number, number, number][]>(() => {
    const arr: [number, number, number][] = []
    const startX = -((serverCount - 1) * boothSpacing) / 2
    for (let i = 0; i < serverCount; i++) {
      arr.push([startX + i * boothSpacing, 0, standZ])
    }
    return arr
  }, [serverCount])

  const snakeCfg: SnakeConfig = useMemo(
    () => ({
      segments: 8,
      segmentLen: 2.6,
      xLeft: -2.0,
      xRight: 2.0,
      startZ: -3.2,
      corridorWidth: 1.6
    }),
    []
  )

  const snakePath = useMemo(() => buildSnakePath(snakeCfg), [snakeCfg])

  const queueTargetForIndex = (idx: number): [number, number, number] => {
    const d = idx * spacing + 0.0001
    return samplePolyline(snakePath, Math.min(d, 9999))
  }

  // ---------------- INIT ----------------
  useEffect(() => {
    // Reiniciamos estado React
    setPassengers([])
    setCompleted(0)
    setAvgWait(0)
    setWaitTimes([])

    setSimClockSec(0)
    setTimeToNextArrival(null)
    setServiceRemaining(Array(serverCount).fill(0))

    // Estado interno
    passengersRef.current = []
    simTime.current = 0
    totalWait.current = 0
    busyUntil.current = Array(serverCount).fill(null)
    scheduleIdx.current = 0

    setPaused(false)
    setShowConclusion(false)
    setAutoConclusionShown(false)

    if (hasSchedule && arrivalsSchedule) {
      // Usar primer arrival del Excel
      nextArrivalAt.current = arrivalsSchedule[0]
    } else {
      // Primera llegada Poisson
      const lambdaPerSec = lambdaPerMin / 60
      nextArrivalAt.current = expSample(lambdaPerSec)

      // Fast-forward si la primera llegada está lejos
      if (nextArrivalAt.current > 5) {
        simTime.current = Math.max(0, nextArrivalAt.current - 0.05)
      }
    }

    console.log('[Simulation:init]', {
      resetVersion,
      lambdaPerMin,
      serverCount,
      firstArrivalSec: nextArrivalAt.current,
      hasSchedule
    })
  }, [resetVersion, lambdaPerMin, serverCount, hasSchedule, arrivalsSchedule])

  // ---------------- MÉTRICAS TEÓRICAS (M/G/1) ----------------
  const meanServiceMin = serviceMeanSec / 60
  const mu = serviceMeanSec > 0 ? 60 / serviceMeanSec : 0 // pax/min
  const cv = serviceCV
  const cv2 = cv * cv

  const lambdaPerSecTheo = lambdaPerMin / 60
  const rhoTheo = ((lambdaPerSecTheo * serviceMeanSec) / Math.max(serverCount, 1)) || 0

  let LqTheo = 0
  let WqTheoMin = 0
  let LTheo = 0
  let WTheoMin = 0
  let P0 = 0

  if (rhoTheo > 0 && rhoTheo < 1 && lambdaPerMin > 0) {
    LqTheo = (rhoTheo * rhoTheo * (1 + cv2)) / (2 * (1 - rhoTheo))
    WqTheoMin = LqTheo / lambdaPerMin
    LTheo = LqTheo + rhoTheo
    WTheoMin = WqTheoMin + meanServiceMin
    P0 = 1 - rhoTheo
  }

  // ---------------- LOOP PRINCIPAL ----------------
  useFrame((_, deltaReal) => {
    if (paused) return

    const dt = Math.min(deltaReal, 0.05)

    // Avanzar tiempo de simulación
    simTime.current += dt * simSpeed
    const now = simTime.current

    const list = passengersRef.current

    // 1) Completar servicios vencidos
    let completedDelta = 0
    const newWaits: number[] = []

    for (let s = 0; s < serverCount; s++) {
      const due = busyUntil.current[s]
      if (due != null && now >= due) {
        const idx = list.findIndex(p => p.state === 'service' && p.serverIdx === s)
        if (idx !== -1) {
          const job = list[idx]
          const wait = (job.serviceStartAt ?? now) - job.arrivalAt
          totalWait.current += wait
          newWaits.push(wait)
          list.splice(idx, 1)
          completedDelta++
        }
        busyUntil.current[s] = null
      }
    }

    if (completedDelta > 0) {
      setCompleted(c => {
        const n = c + completedDelta
        setAvgWait(totalWait.current / n)
        return n
      })
      if (newWaits.length) {
        setWaitTimes(w => [...w, ...newWaits].slice(-300))
      }
    }

    // 2) Llegadas (Excel si hay cronograma, sino Poisson)
    if (hasSchedule && arrivalsSchedule) {
      while (
        scheduleIdx.current < arrivalsSchedule.length &&
        now >= arrivalsSchedule[scheduleIdx.current]
      ) {
        const arrTime = arrivalsSchedule[scheduleIdx.current]
        const qCount = list.filter(p => p.state === 'queue').length
        const pos = queueTargetForIndex(qCount)

        const palette = [
          { shirt: '#2563eb', pants: '#111827', skin: '#d6a77a', accessory: '#3f3f46' },
          { shirt: '#22c55e', pants: '#1f2937', skin: '#f0c8a0', accessory: '#334155' },
          { shirt: '#ef4444', pants: '#0f172a', skin: '#e4b98f', accessory: '#475569' },
          { shirt: '#a855f7', pants: '#111827', skin: '#e0b084', accessory: '#4b5563' }
        ]
        const style = palette[Math.floor(Math.random() * palette.length)]

        const serviceTimeFromSchedule =
          serviceTimesSchedule &&
          serviceTimesSchedule.length > scheduleIdx.current
            ? serviceTimesSchedule[scheduleIdx.current]
            : undefined

        list.push({
          id: Date.now() + Math.random(),
          state: 'queue',
          pos,
          arrivalAt: arrTime,
          appearance: style,
          // campo opcional con duración fija de servicio
          // @ts-expect-error
          serviceTimeSec: serviceTimeFromSchedule
        } as Passenger)

        scheduleIdx.current += 1
      }

      if (scheduleIdx.current < (arrivalsSchedule?.length || 0)) {
        nextArrivalAt.current = arrivalsSchedule![scheduleIdx.current]
      } else {
        nextArrivalAt.current = Number.POSITIVE_INFINITY
      }
    } else {
      const lambdaPerSec = lambdaPerMin / 60
      while (now >= nextArrivalAt.current) {
        const qCount = list.filter(p => p.state === 'queue').length
        const pos = queueTargetForIndex(qCount)

        const palette = [
          { shirt: '#2563eb', pants: '#111827', skin: '#d6a77a', accessory: '#3f3f46' },
          { shirt: '#22c55e', pants: '#1f2937', skin: '#f0c8a0', accessory: '#334155' },
          { shirt: '#ef4444', pants: '#0f172a', skin: '#e4b98f', accessory: '#475569' },
          { shirt: '#a855f7', pants: '#111827', skin: '#e0b084', accessory: '#4b5563' }
        ]
        const style = palette[Math.floor(Math.random() * palette.length)]

        list.push({
          id: Date.now() + Math.random(),
          state: 'queue',
          pos,
          arrivalAt: now,
          appearance: style
        } as Passenger)

        nextArrivalAt.current += expSample(lambdaPerSec)
      }
    }

    // 3) Asignación a servidores libres
    for (let s = 0; s < serverCount; s++) {
      if (busyUntil.current[s] != null) continue
      const idxQ = list.findIndex(p => p.state === 'queue')
      if (idxQ !== -1) {
        const job: any = list[idxQ]
        let sTime = lognormalSample(serviceMeanSec, serviceCV)

        // Si el pasajero trae duración fija desde Excel, usarla
        if (typeof job.serviceTimeSec === 'number' && job.serviceTimeSec > 0) {
          sTime = job.serviceTimeSec
        }

        job.state = 'service'
        job.serverIdx = s
        job.serviceStartAt = now
        job.serviceEndAt = now + sTime
        busyUntil.current[s] = job.serviceEndAt
      }
    }

    // 4) Movimiento en cola (orden FIFO por llegada)
    const queue = list
      .filter(p => p.state === 'queue')
      .sort((a, b) => a.arrivalAt - b.arrivalAt)

    const moveQueueFactor = Math.min(1, 0.15 * simSpeed)
    const moveServiceFactor = Math.min(1, 0.2 * simSpeed)

    queue.forEach((p, i) => {
      const target = queueTargetForIndex(i)
      p.pos = lerp3(p.pos, target, moveQueueFactor)
    })

    // 5) Movimiento hacia cabina cuando están en servicio
    list.forEach(p => {
      if (p.state === 'service' && p.serverIdx != null) {
        const stand = servicePositions[p.serverIdx]
        const target: [number, number, number] = [stand[0], 0, stand[2]]
        p.pos = lerp3(p.pos, target, moveServiceFactor)
      }
    })

    // 6) Actualizar HUD y estado visible SIEMPRE
    setSimClockSec(now)

    const tNext = nextArrivalAt.current - now
    setTimeToNextArrival(
      Number.isFinite(tNext) ? Math.max(tNext, 0) : null
    )

    const remaining = busyUntil.current.map(due =>
      due != null ? Math.max(due - now, 0) : 0
    )
    setServiceRemaining(remaining)

    // Aquí es donde se sincroniza la vista: con esto no se quedan "pegados"
    setPassengers(list.slice())
  })

  // ---------------- Métricas observadas ----------------
  const Lq = useMemo(
    () => passengers.filter(p => p.state === 'queue').length,
    [passengers]
  )

  const inServiceByServer = useMemo(() => {
    const occ = Array(serverCount).fill(false)
    passengers.forEach(p => {
      if (p.state === 'service' && p.serverIdx != null) {
        occ[p.serverIdx] = true
      }
    })
    return occ
  }, [passengers, serverCount])

  const percentile95 = useMemo(() => {
    if (waitTimes.length < 20) return 0
    const sorted = [...waitTimes].sort((a, b) => a - b)
    const idx = Math.floor(sorted.length * 0.95)
    return sorted[idx]
  }, [waitTimes])

  const slaCompliance = useMemo(() => {
    if (waitTimes.length < 20) return 100
    const within = waitTimes.filter(w => w <= slaTarget * 60).length
    return (within / waitTimes.length) * 100
  }, [waitTimes, slaTarget])

  useEffect(() => {
    if (!autoConclusionShown && completed >= 200) {
      setShowConclusion(true)
      setPaused(true)
      setAutoConclusionShown(true)
    }
  }, [autoConclusionShown, completed])

  const meanWaitMinObs = avgWait > 0 ? avgWait / 60 : 0
  const p95MinObs = percentile95 > 0 ? percentile95 / 60 : 0

  // ---------------- Texto de conclusión ----------------
  const conclusionText = useMemo(() => {
    if (completed < 30) {
      return 'Aún no hay suficientes pasajeros procesados para una conclusión estable. Deja correr la simulación hasta que al menos 30–50 pasajeros hayan sido atendidos.'
    }

    const loadDesc =
      rhoTheo >= 1
        ? 'inestable: la demanda supera a la capacidad de servicio y la cola tiende a crecer sin límite.'
        : rhoTheo >= 0.9
          ? 'muy exigida: pequeñas variaciones en la demanda o en los tiempos de servicio pueden disparar la cola.'
          : rhoTheo >= 0.75
            ? 'moderada: existe cola pero se mantiene en niveles manejables.'
            : 'desahogada: la mayor parte del tiempo hay capacidad ociosa en la cabina.'

    let slaText = ''
    if (slaCompliance >= 95) {
      slaText = `Se cumple cómodamente el SLA de ${slaTarget} minutos (≈ ${slaCompliance.toFixed(1)} % de los pasajeros esperan menos que ese tiempo).`
    } else if (slaCompliance >= 85) {
      slaText = `Se está cerca de cumplir el SLA de ${slaTarget} minutos (≈ ${slaCompliance.toFixed(1)} % dentro del objetivo); bastaría con pequeños ajustes en la tasa de llegadas o en los tiempos de atención.`
    } else {
      slaText = `Con un SLA de ${slaTarget} minutos solo ≈ ${slaCompliance.toFixed(1)} % de los pasajeros quedan dentro del objetivo, por lo que el sistema lo incumple de forma sistemática.`
    }

    const queueText =
      Lq === 0
        ? 'Prácticamente no se observan colas visibles en el sistema.'
        : Lq <= 5
          ? 'Las colas observadas son cortas y tienden a disiparse rápidamente.'
          : Lq <= 15
            ? 'Se observan colas de tamaño medio, pero aún manejables para el personal de migración.'
            : 'Se observan colas largas y persistentes, que pueden impactar de forma negativa la experiencia de los pasajeros.'

    const mgx = serverCount === 1 ? 'M/G/1' : 'M/G/c'

    const lines: string[] = []

    lines.push(
      `Con ${completed} pasajeros procesados, el sistema ${mgx} opera con una tasa de llegada de ` +
      `${lambdaPerMin.toFixed(2)} pasajeros/minuto y un tiempo medio de atención de ${(serviceMeanSec / 60).toFixed(2)} minutos.`
    )

    lines.push(
      `Teóricamente, esto produce una intensidad de tráfico ρ ≈ ${rhoTheo.toFixed(2)}, lo que indica que la cabina está ${loadDesc}`
    )

    lines.push(
      `En la simulación, el tiempo medio de espera observado es de ${meanWaitMinObs.toFixed(2)} minutos y el percentil 95 ronda los ${p95MinObs.toFixed(2)} minutos.`
    )

    lines.push(slaText)
    lines.push(queueText)

    if (rhoTheo >= 1) {
      lines.push(
        'Interpretación: con estos parámetros el modelo M/G/1 describe un sistema saturado. ' +
        'Para que el sistema sea estable, en la práctica habría que reducir la tasa de llegada de pasajeros (λ) o incrementar la capacidad de servicio.'
      )
    } else {
      lines.push(
        'Interpretación: estos resultados sirven para argumentar en tu documento si la configuración actual del control migratorio es suficiente ' +
        'o si conviene ajustar la llegada de pasajeros (λ), reorganizar la cola o aumentar la capacidad de servicio.'
      )
    }

    return lines.join(' ')
  }, [avgWait, completed, lambdaPerMin, percentile95, rhoTheo, slaCompliance, slaTarget, serviceMeanSec, Lq, serverCount, meanWaitMinObs, p95MinObs])

  // ---------------- Reporte imprimible ----------------
  const generateReport = () => {
    const win = window.open('', '_blank', 'width=900,height=700')
    if (!win) return

    win.document.write(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8" />
<title>Reporte de Simulación – Control Migratorio</title>
<style>
  body { font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; padding: 24px; line-height: 1.5; color: #111827; }
  h1 { font-size: 20px; margin-bottom: 4px; }
  h2 { font-size: 16px; margin-top: 18px; margin-bottom: 6px; }
  table { border-collapse: collapse; margin-top: 8px; }
  th, td { border: 1px solid #d1d5db; padding: 4px 8px; font-size: 13px; text-align: left; }
</style>
</head>
<body>
  <h1>Reporte de Simulación – Control Migratorio</h1>
  <p>Escenario simulado con el modelo M/G/1 a partir de los parámetros obtenidos en la fase de verificación y validación.</p>

  <h2>Parámetros de entrada</h2>
  <table>
    <tr><th>Parámetro</th><th>Valor</th></tr>
    <tr><td>Tasa de llegada λ</td><td>${lambdaPerMin.toFixed(3)} pasajeros/minuto</td></tr>
    <tr><td>Tiempo medio de servicio E[S]</td><td>${serviceMeanSec.toFixed(2)} s (${meanServiceMin.toFixed(3)} min)</td></tr>
    <tr><td>Coeficiente de variación del servicio (CV)</td><td>${serviceCV.toFixed(2)}</td></tr>
    <tr><td>Tasa de servicio μ</td><td>${mu.toFixed(2)} pasajeros/minuto</td></tr>
    <tr><td>Número de servidores</td><td>${serverCount}</td></tr>
    <tr><td>Objetivo de SLA</td><td>${slaTarget} minutos</td></tr>
  </table>

  <h2>Indicadores teóricos (modelo M/G/1)</h2>
  <table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td>Intensidad del sistema ρ</td><td>${rhoTheo.toFixed(2)}</td></tr>
    <tr><td>Longitud media de la cola Lq</td><td>${LqTheo.toFixed(2)} pasajeros</td></tr>
    <tr><td>Tiempo medio de espera en cola Wq</td><td>${(WqTheoMin * 60).toFixed(1)} s (${WqTheoMin.toFixed(3)} min)</td></tr>
    <tr><td>Longitud media del sistema L</td><td>${LTheo.toFixed(2)} pasajeros</td></tr>
    <tr><td>Tiempo medio total en el sistema W</td><td>${(WTheoMin * 60).toFixed(1)} s (${WTheoMin.toFixed(3)} min)</td></tr>
    <tr><td>Probabilidad de sistema vacío P₀</td><td>${(P0 * 100).toFixed(1)} %</td></tr>
  </table>

  <h2>Indicadores observados en la simulación</h2>
  <table>
    <tr><th>Indicador</th><th>Valor</th></tr>
    <tr><td>Pasajeros procesados</td><td>${completed}</td></tr>
    <tr><td>Tiempo medio de espera observado</td><td>${(meanWaitMinObs * 60).toFixed(1)} s (${meanWaitMinObs.toFixed(3)} min)</td></tr>
    <tr><td>Percentil 95 de espera observado</td><td>${(p95MinObs * 60).toFixed(1)} s (${p95MinObs.toFixed(3)} min)</td></tr>
    <tr><td>Longitud instantánea de cola (Lq)</td><td>${Lq}</td></tr>
    <tr><td>Cumplimiento de SLA</td><td>${slaCompliance.toFixed(1)} %</td></tr>
  </table>

  <p style="margin-top: 18px; font-size: 13px;">
    Este reporte puede guardarse como PDF utilizando la opción de “Imprimir &gt; Guardar como PDF” del navegador.
  </p>
</body>
</html>`)
    win.document.close()
    win.focus()
  }

  return (
    <>
      {/* Escena 3D */}
      <AirportFloor />
      <FloorMarkings />
      <CeilingGrid y={6} />
      <WindowWall width={60} height={4} y={2.5} z={-29} />
      <Columns area={60} />
      <SeatingRow x={-10} z={-16} rotationY={0.2} />
      <SeatingRow x={10} z={-16} rotationY={-0.2} />
      <InfoBoard position={[0, 3.2, -8]} title={'Departures'} />
      <PerimeterWalls size={60} height={3.0} thickness={0.35} />
      <OverheadSignage center={[0, 7, -5]} />
      <ZigZagBarriers cfg={snakeCfg} />
      <MigrationBoothRow
        serviceZ={serviceZ}
        standZ={standZ}
        boothSpacing={boothSpacing}
        count={serverCount}
        occupied={inServiceByServer}
      />
      {passengers.map(p => (
        <PassengerMesh
          key={p.id}
          position={p.pos}
          inService={p.state === 'service'}
          shirt={p.appearance?.shirt}
          pants={p.appearance?.pants}
          skin={p.appearance?.skin}
          accessory={p.appearance?.accessory}
        />
      ))}

      {/* Luces / cámara */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[10, 20, 10]} intensity={0.6} castShadow />
      <pointLight position={[0, 8, 0]} intensity={0.4} />
      <pointLight position={[0, 8, -15]} intensity={0.3} />
      <OrbitControls makeDefault maxPolarAngle={Math.PI / 2.1} minDistance={10} maxDistance={50} />

      {/* HUD con botón de reporte + tiempos vivos */}
      <HUD
        params={params}
        Lq={Lq}
        completed={completed}
        rho={rhoTheo}
        avgWait={avgWait}
        percentile95={percentile95}
        slaTarget={slaTarget}
        slaCompliance={slaCompliance}
        onReport={generateReport}
        simTimeSec={simClockSec}
        timeToNextArrival={timeToNextArrival}
        serviceRemaining={serviceRemaining}
        serversBusy={inServiceByServer}
      />

      {/* Tarjeta de conclusión automática */}
      {showConclusion && (
        <Html fullscreen>
          <div
            style={{
              position: 'fixed',
              bottom: 18,
              left: '50%',
              transform: 'translateX(-50%)',
              maxWidth: 720,
              background: 'rgba(15,23,42,0.96)',
              color: '#e5e7eb',
              borderRadius: 12,
              padding: '14px 18px',
              boxShadow: '0 14px 40px rgba(0,0,0,.6)',
              border: '1px solid #1f2937',
              fontSize: 13,
              lineHeight: 1.5
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 6
              }}
            >
              <strong>Conclusión del escenario simulado</strong>
              <button
                onClick={() => {
                  setShowConclusion(false)
                  setPaused(false)
                }}
                style={{
                  padding: '2px 8px',
                  borderRadius: 999,
                  border: '1px solid #374151',
                  background: 'transparent',
                  color: '#e5e7eb',
                  fontSize: 11,
                  cursor: 'pointer'
                }}
              >
                Cerrar
              </button>
            </div>
            <p style={{ margin: 0 }}>{conclusionText}</p>
          </div>
        </Html>
      )}
    </>
  )
}