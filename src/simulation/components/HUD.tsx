import React from 'react'
import { Html } from '@react-three/drei'
import { SimParams } from '../types'
import { formatSec } from '../utils/format'
import { hudStyle, headerStyle, sectionStyle, sectionTitleStyle, alertStyle } from '../styles/hud'

export default function HUD({
  params,
  Lq,
  completed,
  rho,
  avgWait,
  percentile95,
  slaTarget,
  slaCompliance,
  onReport,
  simTimeSec,
  timeToNextArrival,
  serviceRemaining = []
}: {
  params: SimParams
  Lq: number
  completed: number
  rho: number
  avgWait: number
  percentile95: number
  slaTarget: number
  slaCompliance: number
  onReport?: () => void
  simTimeSec?: number
  timeToNextArrival?: number | null
  serviceRemaining?: number[]
}) {
  const { lambdaPerMin, serviceMeanSec, serviceCV, simSpeed, serverCount } = params
  const mgx = serverCount === 1 ? 'M/G/1' : 'M/G/c'

  const clockLabel = simTimeSec != null ? formatSec(simTimeSec) : '0 s'

  const nextArrivalLabel =
    timeToNextArrival != null
      ? (timeToNextArrival < 0.3
        ? 'llegando…'
        : timeToNextArrival < 10
          ? `${timeToNextArrival.toFixed(1)} s`
          : formatSec(timeToNextArrival))
      : '–'

  return (
    <Html fullscreen>
      <div style={{ ...hudStyle, pointerEvents: 'auto' }}>
        <div style={headerStyle}>
          <h3 style={{ margin: 0, fontSize: '18px' }}>Control Migratorio</h3>
          <span style={{ fontSize: '13px', opacity: 0.8 }}>{mgx}</span>
        </div>

        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>📊 Parámetros</h4>
          <div>λ: <b>{lambdaPerMin.toFixed(1)} pax/min</b></div>
          <div>E[S]: <b>{serviceMeanSec.toFixed(1)} s</b> · CV: <b>{serviceCV.toFixed(2)}</b></div>
          <div>Velocidad: <b>{simSpeed}×</b></div>
          <div>Servidores (c): <b>{serverCount}</b></div>
        </div>

        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>📈 Métricas</h4>
          <div>
            Cola (Lq):{' '}
            <b style={{ color: Lq > 10 ? '#ff6b6b' : '#51cf66' }}>{Lq}</b>
          </div>
          <div>Procesados: <b>{completed}</b></div>
          <div>
            ρ sistema:{' '}
            <b
              style={{
                color:
                  rho > 0.95 ? '#ff6b6b'
                    : rho > 0.75 ? '#ffd43b'
                      : '#51cf66'
              }}
            >
              {rho.toFixed(2)}
            </b>
          </div>
        </div>

        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>⏱️ Espera</h4>
          <div>Media (Wq): <b>{formatSec(avgWait)}</b></div>
          <div>P95: <b>{formatSec(percentile95)}</b></div>
          <div>
            Cumplimiento:{' '}
            <b
              style={{
                color:
                  slaCompliance >= 95 ? '#51cf66'
                    : slaCompliance >= 85 ? '#ffd43b'
                      : '#ff6b6b'
              }}
            >
              {slaCompliance.toFixed(1)}%
            </b>
          </div>
        </div>

        {/* Reloj y próximos eventos */}
        <div style={sectionStyle}>
          <h4 style={sectionTitleStyle}>⏳ Reloj / próximos eventos</h4>
          <div>Tiempo simulado: <b>{clockLabel}</b></div>
          <div>Próxima llegada en: <b>{nextArrivalLabel}</b></div>
          {serviceRemaining && serviceRemaining.length > 0 && (
            <div style={{ marginTop: 4, fontSize: 12 }}>
              {serviceRemaining.map((t, i) => {
                const busy = t > 0.05
                let label: string
                if (!busy) {
                  label = 'libre'
                } else if (t > 0.1) {
                  label = formatSec(t)
                } else {
                  label = '≈0 s'
                }
                return (
                  <div key={i}>
                    Servidor {i + 1}:{' '}
                    <b>{label}</b>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {rho >= 0.98 && (
          <div style={alertStyle}>
            <b>⚠️ Sistema sobrecargado</b>
            <div style={{ fontSize: '12px', marginTop: '4px' }}>
              Abre cabinas adicionales para reducir la espera.
            </div>
          </div>
        )}

        {/* Botón de reporte */}
        <div style={{ marginTop: '10px', textAlign: 'right' }}>
          <button
            onClick={onReport}
            disabled={!onReport}
            style={{
              padding: '6px 10px',
              borderRadius: 8,
              border: '1px solid #1f2937',
              background: onReport ? '#f97316' : '#4b5563',
              color: '#111827',
              fontSize: 12,
              cursor: onReport ? 'pointer' : 'default',
              opacity: onReport ? 1 : 0.6
            }}
          >
            Generar reporte
          </button>
        </div>
      </div>
    </Html>
  )
}
