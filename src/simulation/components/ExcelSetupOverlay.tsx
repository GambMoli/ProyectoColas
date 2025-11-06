// src/simulation/components/ExcelSetupOverlay.tsx
import React, { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

export type Derived = {
  lambdaPerMin: number
  serviceMeanSec: number
  serviceCV: number
  arrivalsSec?: number[]
  serviceTimesSec?: number[]
}

type ManualMap = {
  sheetName?: string
  arrivalCol?: string
  // Modo A: "Duración": tiempos de servicio como duración directa
  durationCol?: string
  durationUnit?: 'sec' | 'min'
  // Modo B: "Inicio/Fin": tiempos de servicio como hora inicio/hora fin
  startCol?: string
  endCol?: string
}

function sd(nums: number[]) {
  const n = nums.length
  if (n <= 1) return 0
  const mean = nums.reduce((a, b) => a + b, 0) / n
  const v = nums.reduce((acc, x) => acc + (x - mean) * (x - mean), 0) / (n - 1)
  return Math.sqrt(v)
}

function parseExcelDate(val: any): Date | null {
  if (val == null || val === '') return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number' && isFinite(val)) {
    // Excel serial → Date
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S || 0)
  }
  // Texto/ISO/HH:MM:SS
  if (typeof val === 'string' && /^\d{1,2}:\d{2}:\d{2}$/.test(val.trim())) {
    const [H, M, S] = val.trim().split(':').map(Number)
    const base = new Date(2000, 0, 1, 0, 0, 0)
    base.setHours(H, M, S || 0, 0)
    return base
  }
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function timeDiffSec(a: Date, b: Date) {
  return (a.getTime() - b.getTime()) / 1000
}

function secondsFromFirst(arrivals: Date[]) {
  if (!arrivals.length) return []
  const first = arrivals[0]
  return arrivals.map(d => Math.max(0, timeDiffSec(d, first)))
}

function lambdaFromWindowSeconds(t0: Date, t1: Date, count: number) {
  const sec = Math.max(1, (t1.getTime() - t0.getTime()) / 1000)
  const perMin = (count / sec) * 60
  return perMin
}

/** Construye λ, E[S], CV y vectores de cronograma a partir de filas mapeadas. */
function buildDerivedFromRows(
  rows: Record<string, any>[],
  arrivalCol: string | undefined,
  opts:
    | { mode: 'duracion'; durationCol: string; durationUnit: 'sec' | 'min' }
    | { mode: 'iniciofin'; startCol: string; endCol: string }
): Derived | null {
  if (!arrivalCol) return null
  const arrDates: Date[] = []
  const serviceTimesSec: number[] = []

  for (const r of rows) {
    const a = parseExcelDate(r[arrivalCol])
    if (!a) continue

    arrDates.push(a)

    if (opts.mode === 'duracion') {
      const raw = r[opts.durationCol]
      if (raw == null || raw === '') continue
      let seconds = 0
      if (typeof raw === 'number') {
        // número (asumimos segundos si unit=sec, o minutos si unit=min)
        seconds = opts.durationUnit === 'sec' ? raw : raw * 60
      } else if (typeof raw === 'string') {
        const v = parseFloat(raw.replace(',', '.'))
        seconds = opts.durationUnit === 'sec' ? v : v * 60
      }
      if (isFinite(seconds) && seconds > 0) serviceTimesSec.push(seconds)
    } else {
      const s = parseExcelDate(r[opts.startCol])
      const e = parseExcelDate(r[opts.endCol])
      if (s && e) {
        const sec = Math.max(0, timeDiffSec(e, s))
        if (sec > 0) serviceTimesSec.push(sec)
      }
    }
  }

  if (arrDates.length < 3) return null
  const arrivalsSec = secondsFromFirst(arrDates)

  // λ estimado: (# arribos) / ventana (min)
  const lambdaPerMin = lambdaFromWindowSeconds(arrDates[0], arrDates[arrDates.length - 1], arrDates.length)

  // E[S] y CV desde columna de servicio si existe
  let meanS = 0, cv = 0
  if (serviceTimesSec.length >= 3) {
    meanS = serviceTimesSec.reduce((a, b) => a + b, 0) / serviceTimesSec.length
    const sdev = sd(serviceTimesSec)
    cv = meanS > 0 ? sdev / meanS : 0
  } else {
    // si no tenemos duración, al menos poner un default razonable
    meanS = 45
    cv = 0.5
  }

  return {
    lambdaPerMin: Math.max(lambdaPerMin, 0.01),
    serviceMeanSec: Math.max(meanS, 0.1),
    serviceCV: Math.max(Math.min(cv, 5), 0.01),
    arrivalsSec,
    serviceTimesSec: serviceTimesSec.length ? serviceTimesSec : undefined
  }
}

/** Uniforme(min,max) → mean y CV (rápido para set manual) */
function uniformMeanCvFromRange(minSec: number, maxSec: number) {
  const a = Math.max(0.01, Math.min(minSec, maxSec))
  const b = Math.max(0.02, Math.max(minSec, maxSec))
  const mean = (a + b) / 2
  // Var = (b - a)^2 / 12 → sd = (b - a)/sqrt(12) → cv = sd/mean
  const sdVal = (b - a) / Math.sqrt(12)
  const cv = sdVal / mean
  return { mean, cv }
}

type Props = { onReady: (d: Derived) => void }

export default function ExcelSetupOverlay({ onReady }: Props) {
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string | undefined>(undefined)
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [error, setError] = useState<string | null>(null)

  const [manual, setManual] = useState<ManualMap>({})
  const [loading, setLoading] = useState(false)

  // QUICK (manual sin Excel)
  const [quickLambdaHour, setQuickLambdaHour] = useState('120') // pax/h
  const [quickMin, setQuickMin] = useState('30')               // seg
  const [quickMax, setQuickMax] = useState('70')               // seg

  // Cargar archivo
  const handleFile = async (f: File) => {
    setLoading(true)
    try {
      const buf = await f.arrayBuffer()
      const book = XLSX.read(buf, { type: 'array' })
      setWb(book)
      setSheetNames(book.SheetNames || [])
      setSelectedSheet(book.SheetNames?.[0])
      setError(null)
    } catch (e) {
      console.error(e)
      setError('No se pudo leer el archivo.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!wb || !selectedSheet) {
      setRows([])
      return
    }
    const ws = wb.Sheets[selectedSheet]
    const json = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { raw: true })
    setRows(json)
  }, [wb, selectedSheet])

  const info = useMemo(() => {
    if (!rows.length) return null
    try {
      // Autodetección muy simple de columnas frecuentes
      const headers = Object.keys(rows[0] || {})
      const lower = headers.map(h => h.toLowerCase())
      const find = (...candidates: string[]) => {
        for (const c of candidates) {
          const i = lower.findIndex(h => h.includes(c))
          if (i !== -1) return headers[i]
        }
        return undefined
      }

      const arrival = manual.arrivalCol || find('arribo', 'lleg', 'hora', 'arrival')
      const duration = manual.durationCol
      const startC = manual.startCol
      const endC = manual.endCol

      if (!arrival) return null

      if (duration) {
        return buildDerivedFromRows(rows, arrival, {
          mode: 'duracion',
          durationCol: duration,
          durationUnit: manual.durationUnit || 'sec'
        })
      }

      if (startC && endC) {
        return buildDerivedFromRows(rows, arrival, {
          mode: 'iniciofin',
          startCol: startC,
          endCol: endC
        })
      }

      // Si solo hay llegada, estimamos λ y ponemos defaults de servicio
      const arrDates: Date[] = rows
        .map(r => parseExcelDate(r[arrival!]))
        .filter((d): d is Date => !!d)

      if (arrDates.length < 3) return null

      const lambdaPerMin = lambdaFromWindowSeconds(arrDates[0], arrDates[arrDates.length - 1], arrDates.length)
      const arrivalsSec = secondsFromFirst(arrDates)
      return {
        lambdaPerMin: Math.max(0.01, lambdaPerMin),
        serviceMeanSec: 45,
        serviceCV: 0.5,
        arrivalsSec
      } as Derived
    } catch (e) {
      console.error(e)
      return null
    }
  }, [rows, manual])

  const startAuto = () => {
    if (info) onReady(info)
  }

  const quickDerived = useMemo<Derived>(() => {
    const lamHour = Math.max(1, parseFloat(quickLambdaHour.replace(',', '.')) || 120) // pax/h
    const lambdaPerMin = lamHour / 60
    const a = Math.max(0.01, parseFloat(quickMin.replace(',', '.')) || 30)
    const b = Math.max(a + 0.01, parseFloat(quickMax.replace(',', '.')) || 70)
    const { mean, cv } = uniformMeanCvFromRange(a, b)
    return {
      lambdaPerMin,
      serviceMeanSec: Math.max(mean, 0.1),
      serviceCV: Math.max(Math.min(cv, 5), 0.01)
    }
  }, [quickLambdaHour, quickMin, quickMax])

  return (
    <div style={{ position:'fixed', inset:0, display:'grid', placeItems:'center', background:'#0b1220', color:'#e5e7eb' }}>
      <div style={{ width: 920, maxWidth: '92vw', background:'#111827', padding:18, borderRadius:14, border:'1px solid #374151' }}>
        <h2 style={{ margin:'6px 0 12px 0' }}>Configurar Simulación de Control Migratorio (M/G/1)</h2>

        <div style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr', gap:18 }}>
          {/* Panel Excel */}
          <div style={{ background:'#0f172a', border:'1px solid #1f2937', padding:12, borderRadius:12 }}>
            <h3 style={{marginTop:0}}>Desde Excel (opcional)</h3>
            <p style={{marginTop:6, opacity:.85, fontSize:13}}>
              Sube tu archivo y mapea columnas: <b>llegada</b>, y opcional <b>duración</b> (o <b>inicio/fin</b>).
              Los tiempos se convierten a segundos desde la primera llegada (no quedarán todas en 00:00:00 😉).
            </p>

            <div style={{ display:'flex', gap:8, alignItems:'center', margin:'8px 0 10px' }}>
              <label style={{ padding:'8px 12px', border:'1px solid #293144', borderRadius:8, background:'#0b1220', cursor:'pointer' }}>
                Seleccionar archivo…
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  style={{ display:'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
                />
              </label>

              {!!sheetNames.length && (
                <select
                  value={selectedSheet || ''}
                  onChange={(e) => setSelectedSheet(e.target.value)}
                  style={{ background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px' }}
                >
                  {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              )}

              {loading && <span style={{fontSize:13, opacity:.8}}>Procesando…</span>}
            </div>

            {error && <div style={{marginTop:8, marginBottom:12, fontSize:13, color:'#fca5a5'}}>{error}</div>}

            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
              <div>
                <label>Columna de llegada</label>
                <input
                  style={{ width:'100%', marginTop:4 }}
                  placeholder="Ej: llegada, hora, ArrivalTime"
                  value={manual.arrivalCol || ''}
                  onChange={e => setManual(m => ({ ...m, arrivalCol: e.target.value }))}
                />
              </div>
              <div>
                <label>Duración (seg/min) — opcional</label>
                <div style={{ display:'grid', gridTemplateColumns:'1fr auto', gap:8 }}>
                  <input
                    placeholder="Ej: duracion, service_time"
                    value={manual.durationCol || ''}
                    onChange={e => setManual(m => ({ ...m, durationCol: e.target.value }))}
                  />
                  <select
                    value={manual.durationUnit || 'sec'}
                    onChange={e => setManual(m => ({ ...m, durationUnit: e.target.value as any }))}
                  >
                    <option value="sec">seg</option>
                    <option value="min">min</option>
                  </select>
                </div>
              </div>
              <div>
                <label>Inicio servicio — opcional</label>
                <input
                  placeholder="Ej: inicio"
                  value={manual.startCol || ''}
                  onChange={e => setManual(m => ({ ...m, startCol: e.target.value }))}
                />
              </div>
              <div>
                <label>Fin servicio — opcional</label>
                <input
                  placeholder="Ej: fin"
                  value={manual.endCol || ''}
                  onChange={e => setManual(m => ({ ...m, endCol: e.target.value }))}
                />
              </div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button
                onClick={startAuto}
                disabled={!info}
                style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937',
                         background: info ? '#2563eb' : '#374151', color:'#fff', fontWeight:600,
                         cursor: info ? 'pointer' : 'not-allowed' }}
              >
                Iniciar con detección desde Excel
              </button>
            </div>
          </div>

          {/* Panel manual */}
          <div style={{ background:'#0f172a', border:'1px solid #1f2937', padding:12, borderRadius:12 }}>
            <h3 style={{marginTop:0}}>Configurar manualmente</h3>
            <p style={{marginTop:6, opacity:.85, fontSize:13}}>
              Define λ (pax/h) y un rango de servicio [min,max] (seg). Se convierte a E[S] y CV (uniforme).
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10 }}>
              <div>
                <label>λ (pasajeros/hora)</label>
                <input value={quickLambdaHour} onChange={e => setQuickLambdaHour(e.target.value)} />
              </div>
              <div />
              <div>
                <label>Servicio mínimo (seg)</label>
                <input value={quickMin} onChange={e => setQuickMin(e.target.value)} />
              </div>
              <div>
                <label>Servicio máximo (seg)</label>
                <input value={quickMax} onChange={e => setQuickMax(e.target.value)} />
              </div>
            </div>

            <div style={{ marginTop:10, fontSize:13 }}>
              <div>λ ≈ <b>{quickDerived.lambdaPerMin.toFixed(3)}</b> pax/min</div>
              <div>E[S] ≈ <b>{quickDerived.serviceMeanSec.toFixed(2)}</b> seg</div>
              <div>CV servicio ≈ <b>{quickDerived.serviceCV.toFixed(2)}</b></div>
            </div>

            <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:12 }}>
              <button
                onClick={() => onReady(quickDerived)}
                style={{ padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937', background:'#22c55e', color:'#0b1220', fontWeight:700 }}
              >
                Iniciar con parámetros manuales
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
