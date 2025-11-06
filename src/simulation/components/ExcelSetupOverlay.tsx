import React, { useEffect, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'

export type Derived = {
  lambdaPerMin: number
  serviceMeanSec: number
  serviceCV: number
  // cronograma exacto (si viene del Excel)
  arrivalsSec?: number[]
  serviceTimesSec?: number[]
}

type ManualMap = {
  sheetName?: string
  arrivalCol?: string
  mode: 'duracion' | 'iniciofin'
  durationCol?: string
  durationUnit: 'seg' | 'min'
  startCol?: string
  endCol?: string
}

function sd(nums: number[]) {
  if (nums.length < 2) return 0
  const m = nums.reduce((a, b) => a + b, 0) / nums.length
  const v = nums.reduce((a, b) => a + (b - m) ** 2, 0) / (nums.length - 1)
  return Math.sqrt(v)
}

function parseDate(val: any): Date | null {
  if (val == null || val === '') return null
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val
  if (typeof val === 'number' && isFinite(val)) {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return new Date(d.y, d.m - 1, d.d, d.H, d.M, d.S || 0)
  }
  const d = new Date(val)
  return isNaN(d.getTime()) ? null : d
}

function pickColumns(headers: string[]) {
  const H = headers.map(h => h.toLowerCase())
  const find = (keys: string[]) =>
    H.map((h, i) => ({ h, i }))
      .filter(o => keys.some(k => o.h.includes(k)))
      .map(o => headers[o.i])

  const serviceCandidates = H
    .map((h, i) => ({ h, i }))
    .filter(o =>
      (o.h.includes('servicio') || o.h.includes('service') || o.h.includes('atencion')) &&
      !o.h.includes('espera') &&
      !o.h.includes('total')
    )
    .map(o => headers[o.i])

  return {
    arrival: find(['lleg', 'arrib', 'ingres', 'arrival', 'fecha', 'hora', 'timestamp']),
    start:   find(['inicio', 'start', 'atencion_inicio', 'servicio_inicio']),
    end:     find(['fin', 'end', 'final', 'atencion_fin', 'servicio_fin']),
    service: serviceCandidates.length ? serviceCandidates : find(['durac', 'servicio', 'service', 'atencion'])
  }
}

function lambdaFromWholeWindow(arrivals: Date[]): number {
  if (arrivals.length < 2) return 0
  const first = arrivals[0].getTime()
  const last = arrivals[arrivals.length - 1].getTime()
  const minutes = Math.max((last - first) / 60000, 1e-6) // evita 0 si todo cae en el mismo segundo
  return arrivals.length / minutes
}

function buildDerivedFromRows(
  rows: Record<string, any>[],
  arrivalCol: string,
  opts:
    | { mode: 'duracion'; durationCol: string; durationUnit: 'seg' | 'min' }
    | { mode: 'iniciofin'; startCol: string; endCol: string }
): Derived | null {
  type Pair = { arr: Date; serviceSec: number }
  const pairs: Pair[] = []

  for (const r of rows) {
    const arrDate = parseDate(r[arrivalCol])
    if (!arrDate) continue

    let serviceSec: number | null = null
    if (opts.mode === 'duracion') {
      const raw = r[opts.durationCol]
      if (raw != null && raw !== '') {
        const num = typeof raw === 'number' ? raw : Number(String(raw).replace(',', '.'))
        if (isFinite(num) && num > 0) {
          serviceSec = opts.durationUnit === 'min' ? num * 60 : num
        }
      }
    } else {
      const d1 = parseDate(r[opts.startCol])
      const d2 = parseDate(r[opts.endCol])
      if (d1 && d2) {
        const secs = (d2.getTime() - d1.getTime()) / 1000
        if (secs > 0) serviceSec = secs
      }
    }

    if (serviceSec && serviceSec > 0) {
      pairs.push({ arr: arrDate, serviceSec })
    }
  }

  if (pairs.length < 3) return null

  pairs.sort((a, b) => a.arr.getTime() - b.arr.getTime())

  const t0 = pairs[0].arr.getTime()
  const arrivalsSec = pairs.map(p => Math.max(0, (p.arr.getTime() - t0) / 1000))
  const serviceTimesSec = pairs.map(p => p.serviceSec)

  const arrivalDatesSorted = pairs.map(p => p.arr)
  const lambdaPerMin = lambdaFromWholeWindow(arrivalDatesSorted)

  const meanS = serviceTimesSec.reduce((a, b) => a + b, 0) / serviceTimesSec.length
  const cv = meanS > 0 ? sd(serviceTimesSec) / meanS : 0

  return {
    lambdaPerMin: Math.max(lambdaPerMin, 0.01),
    serviceMeanSec: Math.max(meanS, 0.1),
    serviceCV: Math.max(Math.min(cv, 5), 0.01),
    arrivalsSec,
    serviceTimesSec
  }
}

function deriveAuto(rows: Record<string, any>[]): Derived | null {
  if (!rows || rows.length < 5) return null
  const headers = Object.keys(rows[0] || {})
  const { arrival, start, end, service } = pickColumns(headers)
  if (!arrival.length) return null
  const arrivalCol = arrival[0]

  if (service.length) {
    const durationCol = service[0]
    return buildDerivedFromRows(rows, arrivalCol, {
      mode: 'duracion',
      durationCol,
      durationUnit: 'min' // Excel típico con minutos decimales
    })
  }

  if (start.length && end.length) {
    return buildDerivedFromRows(rows, arrivalCol, {
      mode: 'iniciofin',
      startCol: start[0],
      endCol: end[0]
    })
  }

  return null
}

function deriveManual(rows: Record<string, any>[], map: ManualMap): Derived | null {
  if (!rows || rows.length < 5) return null
  if (!map.arrivalCol) return null

  if (map.mode === 'duracion') {
    if (!map.durationCol) return null
    return buildDerivedFromRows(rows, map.arrivalCol, {
      mode: 'duracion',
      durationCol: map.durationCol,
      durationUnit: map.durationUnit
    })
  } else {
    if (!map.startCol || !map.endCol) return null
    return buildDerivedFromRows(rows, map.arrivalCol, {
      mode: 'iniciofin',
      startCol: map.startCol,
      endCol: map.endCol
    })
  }
}

// ---- helpers modo rápido sin Excel ----
function uniformMeanCvFromRange(minSec: number, maxSec: number) {
  if (!(minSec > 0) || !(maxSec > minSec)) return null
  const mean = (minSec + maxSec) / 2
  const variance = (maxSec - minSec) ** 2 / 12
  const sdVal = Math.sqrt(variance)
  const cv = sdVal / mean
  return { mean, cv }
}

function parsePositive(str: string): number | null {
  if (str == null) return null
  const n = Number(String(str).trim().replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

export default function ExcelSetupOverlay({ onReady }: { onReady: (d: Derived) => void }) {
  const [wb, setWb] = useState<XLSX.WorkBook | null>(null)
  const [sheetNames, setSheetNames] = useState<string[]>([])
  const [selectedSheet, setSelectedSheet] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, any>[]>([])
  const [headers, setHeaders] = useState<string[]>([])
  const [info, setInfo] = useState<Derived | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  // mapeo manual desde Excel
  const [manual, setManual] = useState<ManualMap>({ mode: 'duracion', durationUnit: 'seg' })

  // modo rápido sin Excel
  const [quickLambdaHour, setQuickLambdaHour] = useState('120')
  const [quickPreset, setQuickPreset] = useState<'1-5' | '5-10' | '10-20' | 'custom'>('5-10')
  const [quickMin, setQuickMin] = useState('5')
  const [quickMax, setQuickMax] = useState('10')

  const handleFile = async (file: File) => {
    setError(null); setInfo(null); setLoading(true)
    try {
      const isCSV = /\.csv$/i.test(file.name)
      if (isCSV) {
        const text = await file.text()
        const sheet = XLSX.read(text, { type: 'string' })
        setWb(sheet)
        setSheetNames(sheet.SheetNames)
        setSelectedSheet(sheet.SheetNames[0] || null)
      } else {
        const buf = await file.arrayBuffer()
        const sheet = XLSX.read(buf, { type: 'array', cellDates: true, cellNF: false, cellText: false })
        setWb(sheet)
        setSheetNames(sheet.SheetNames)
        setSelectedSheet(sheet.SheetNames[0] || null)
      }
    } catch (e: any) {
      setError(`Error leyendo archivo: ${e?.message || e}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!wb || !selectedSheet) { setRows([]); setHeaders([]); return }
    const sh = wb.Sheets[selectedSheet]
    const data = XLSX.utils.sheet_to_json<Record<string, any>>(sh, {
      raw: false,
      defval: null,
      dateNF: 'yyyy-mm-dd HH:MM:SS'
    })

    setRows(data)
    setHeaders(Object.keys(data[0] || {}))

    const auto = deriveAuto(data)
    if (auto) {
      setInfo(auto); setError(null)
    } else {
      setInfo(null); setError('No pude detectar columnas automáticamente. Configura el mapeo manual abajo.')
    }

    setManual(m => ({
      ...m,
      sheetName: selectedSheet,
      arrivalCol: undefined,
      durationCol: undefined,
      startCol: undefined,
      endCol: undefined
    }))
  }, [wb, selectedSheet])

  const startAuto = () => {
    if (info) onReady(info)
  }

  const startManual = () => {
    const d = deriveManual(rows, manual)
    if (!d) {
      setError('Revisa el mapeo manual: llegada obligatoria y duración o inicio/fin con al menos 3 valores válidos.')
      return
    }
    setError(null)
    onReady(d)
  }

  const rhoFromInfo = useMemo(() => {
    if (!info) return null
    return (info.lambdaPerMin / 60) * info.serviceMeanSec
  }, [info])

  const quickDerived: Derived | null = useMemo(() => {
    const lambdaHour = parsePositive(quickLambdaHour)
    if (!lambdaHour) return null
    const lambdaPerMin = lambdaHour / 60

    let minS: number
    let maxS: number
    if (quickPreset === '1-5') { minS = 1; maxS = 5 }
    else if (quickPreset === '5-10') { minS = 5; maxS = 10 }
    else if (quickPreset === '10-20') { minS = 10; maxS = 20 }
    else {
      const m1 = parsePositive(quickMin)
      const m2 = parsePositive(quickMax)
      if (!m1 || !m2) return null
      minS = m1; maxS = m2
    }

    const uniformProps = uniformMeanCvFromRange(minS, maxS)
    if (!uniformProps) return null

    const meanS = uniformProps.mean
    const cv = uniformProps.cv

    return {
      lambdaPerMin,
      serviceMeanSec: Math.max(meanS, 0.1),
      serviceCV: Math.max(Math.min(cv, 5), 0.01),
      arrivalsSec: undefined,
      serviceTimesSec: undefined
    }
  }, [quickLambdaHour, quickPreset, quickMin, quickMax])

  const quickRho = useMemo(() => {
    if (!quickDerived) return null
    return (quickDerived.lambdaPerMin / 60) * quickDerived.serviceMeanSec
  }, [quickDerived])

  const startQuick = () => {
    if (!quickDerived) {
      setError('Completa los campos del escenario rápido con valores positivos.')
      return
    }
    const rho = (quickDerived.lambdaPerMin / 60) * quickDerived.serviceMeanSec
    if (rho >= 1) {
      setError('Con estos valores, ρ ≥ 1 (sistema M/G/1 inestable). Reduce λ o E[S].')
      return
    }
    setError(null)
    onReady(quickDerived)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, display: 'grid', placeItems: 'center',
      background: 'linear-gradient(180deg,#0b1020 0%, #111827 70%)', zIndex: 9999
    }}>
      <div style={{
        width: 780, maxWidth: '96%', background: '#0f172a', color: '#e5e7eb',
        borderRadius: 16, padding: 20, boxShadow: '0 20px 60px rgba(0,0,0,.5)', border: '1px solid #1f2937'
      }}>
        <h2 style={{margin: 0, marginBottom: 8}}>Simulación Control Migratorio (Excel o Manual)</h2>
        <p style={{opacity: .85, marginTop: 0}}>
          Sube un <b>.xlsx/.csv</b> para reproducir llegada por llegada, o usa el <b>escenario manual rápido</b> sin Excel.
        </p>

        {/* Carga de archivo */}
        <div style={{display:'flex', gap:10, alignItems:'center', marginBottom: 10}}>
          <label style={{
            display: 'inline-block', border: '1px dashed #374151', borderRadius: 12, padding: 12, cursor: 'pointer',
            background: 'rgba(31,41,55,.35)'
          }}>
            <span>Elegir archivo</span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              style={{display:'none'}}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
            />
          </label>

          {!!sheetNames.length && (
            //@ts-ignore
            <select
              value={selectedSheet || ''}
              onChange={(e) => setSelectedSheet(e.target.value)}
              style={{background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
            >
              {sheetNames.map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          )}

          {loading && <span style={{fontSize:13, opacity:.8}}>Procesando…</span>}
        </div>

        {error && <div style={{marginTop:8, marginBottom:12, fontSize:13, color:'#fca5a5'}}>{error}</div>}

        {/* Resumen auto-detectado */}
        {info && (
          <div style={{
            marginTop:8,
            display:'grid',
            gridTemplateColumns:'repeat(4,1fr)',
            gap:12,
            background:'#0b1220',
            padding:12,
            borderRadius:8,
            fontSize:13
          }}>
            <div>λ (pax/min): <b>{info.lambdaPerMin.toFixed(3)}</b></div>
            <div>E[S] (seg): <b>{info.serviceMeanSec.toFixed(1)}</b></div>
            <div>CV servicio: <b>{info.serviceCV.toFixed(2)}</b></div>
            <div>
              ρ estimado (c = 1):{' '}
              <b style={{
                color: !rhoFromInfo ? '#e5e7eb'
                  : (rhoFromInfo >= 1 ? '#f97373' : rhoFromInfo >= 0.8 ? '#facc15' : '#4ade80')
              }}>
                {rhoFromInfo != null ? rhoFromInfo.toFixed(2) : '–'}
              </b>
            </div>
          </div>
        )}

        {/* Mapeo manual desde Excel */}
        {headers.length > 0 && (
          <div style={{marginTop:16, padding:12, borderRadius:10, background:'#0b1220', border:'1px solid #1f2937'}}>
            <h3 style={{margin:'0 0 8px 0', fontSize:16}}>Mapeo manual desde Excel</h3>
            <div style={{display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:10}}>
              <div>
                <label style={{fontSize:12, opacity:.8}}>Columna de llegada</label>
                //@ts-ignore
                <select
                  value={manual.arrivalCol || ''}
                  onChange={e => setManual(m => ({ ...m, arrivalCol: e.target.value || undefined }))}
                  style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                >
                  <option value="">— seleccionar —</option>
                  {headers.map(h => <option key={h} value={h}>{h}</option>)}
                </select>
              </div>

              <div>
                <label style={{fontSize:12, opacity:.8}}>Modo de servicio</label>
                <select
                  value={manual.mode}
                  onChange={e => setManual(m => ({ ...m, mode: e.target.value as ManualMap['mode'] }))}
                  style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                >
                  <option value="duracion">Duración directa</option>
                  <option value="iniciofin">Inicio / Fin</option>
                </select>
              </div>

              {manual.mode === 'duracion' ? (
                <>
                  <div>
                    <label style={{fontSize:12, opacity:.8}}>Columna de duración</label>
                    <select
                      value={manual.durationCol || ''}
                      onChange={e => setManual(m => ({ ...m, durationCol: e.target.value || undefined }))}
                      style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                    >
                      <option value="">— seleccionar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12, opacity:.8}}>Unidad</label>
                    <select
                      value={manual.durationUnit}
                      onChange={e => setManual(m => ({ ...m, durationUnit: e.target.value as 'seg' | 'min' }))}
                      style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                    >
                      <option value="seg">Segundos</option>
                      <option value="min">Minutos</option>
                    </select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label style={{fontSize:12, opacity:.8}}>Inicio de atención</label>
                    <select
                      value={manual.startCol || ''}
                      onChange={e => setManual(m => ({ ...m, startCol: e.target.value || undefined }))}
                      style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                    >
                      <option value="">— seleccionar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{fontSize:12, opacity:.8}}>Fin de atención</label>
                    <select
                      value={manual.endCol || ''}
                      onChange={e => setManual(m => ({ ...m, endCol: e.target.value || undefined }))}
                      style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                    >
                      <option value="">— seleccionar —</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </>
              )}
            </div>

            <div style={{display:'flex', justifyContent:'flex-end', gap:8, marginTop:12}}>
              <button
                onClick={startManual}
                style={{padding:'9px 14px', borderRadius:10, border:'1px solid #1f2937', background:'#22c55e', color:'#0b1020', fontWeight:600, cursor:'pointer'}}
              >
                Iniciar con mapeo manual
              </button>
            </div>
          </div>
        )}

        {/* Escenario rápido sin Excel */}
        <div style={{marginTop:16, padding:12, borderRadius:10, background:'#020617', border:'1px solid #1f2937'}}>
          <h3 style={{margin:'0 0 6px 0', fontSize:16}}>Escenario rápido sin Excel (M/G/1)</h3>
          <p style={{margin:'0 0 8px 0', fontSize:12, opacity:.8}}>
            Define λ y un rango de tiempos de servicio. El rango (uniforme) se transforma en E[S] y CV.
          </p>

          <div style={{display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:10}}>
            <div>
              <label style={{fontSize:12, opacity:.8}}>Llegadas por hora (λ·h)</label>
              <input
                type="number"
                min={1}
                value={quickLambdaHour}
                onChange={e => setQuickLambdaHour(e.target.value)}
                style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
              />
            </div>

            <div>
              <label style={{fontSize:12, opacity:.8}}>Rango de servicio (seg)</label>
              <select
                value={quickPreset}
                onChange={e => setQuickPreset(e.target.value as any)}
                style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
              >
                <option value="1-5">1 – 5</option>
                <option value="5-10">5 – 10</option>
                <option value="10-20">10 – 20</option>
                <option value="custom">Personalizado…</option>
              </select>
            </div>

            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, alignItems:'end'}}>
              <div>
                <label style={{fontSize:12, opacity:.8}}>Mín (seg)</label>
                <input
                  type="number"
                  min={0.1}
                  disabled={quickPreset !== 'custom'}
                  value={quickMin}
                  onChange={e => setQuickMin(e.target.value)}
                  style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                />
              </div>
              <div>
                <label style={{fontSize:12, opacity:.8}}>Máx (seg)</label>
                <input
                  type="number"
                  min={0.2}
                  disabled={quickPreset !== 'custom'}
                  value={quickMax}
                  onChange={e => setQuickMax(e.target.value)}
                  style={{width:'100%', background:'#0b1220', color:'#e5e7eb', border:'1px solid #293144', borderRadius:8, padding:'8px 10px'}}
                />
              </div>
            </div>
          </div>

          {quickDerived && (
            <div style={{marginTop:10, fontSize:12, background:'#020617', borderRadius:8, padding:'8px 10px', border:'1px dashed #1f2937'}}>
              <div>λ ≈ <b>{quickDerived.lambdaPerMin.toFixed(3)}</b> pax/min</div>
              <div>E[S] ≈ <b>{quickDerived.serviceMeanSec.toFixed(2)}</b> s · CV ≈ <b>{quickDerived.serviceCV.toFixed(2)}</b></div>
              {quickRho != null && (
                <div>
                  ρ (c = 1) ≈{' '}
                  <b style={{ color: quickRho >= 1 ? '#f97373' : quickRho >= 0.8 ? '#facc15' : '#4ade80' }}>
                    {quickRho.toFixed(2)}
                  </b>
                </div>
              )}
            </div>
          )}

          <div style={{display:'flex', justifyContent:'flex-end', marginTop:10}}>
            <button
              onClick={startQuick}
              style={{
                padding:'9px 14px',
                borderRadius:10,
                border:'1px solid #1f2937',
                background:'#22c55e',
                color:'#0b1020',
                fontWeight:600,
                cursor:'pointer'
              }}
            >
              Iniciar simulación manual
            </button>
          </div>
        </div>

        {/* Botón auto Excel */}
        <div style={{display:'flex', gap:8, justifyContent:'flex-end', marginTop:16}}>
          <button
            onClick={startAuto}
            disabled={!info}
            style={{
              padding:'10px 14px', borderRadius:10, border:'1px solid #1f2937',
              background: info ? '#2563eb' : '#374151', color:'#fff', fontWeight:600,
              cursor: info ? 'pointer' : 'not-allowed'
            }}
          >
            Iniciar con detección automática desde Excel
          </button>
        </div>
      </div>
    </div>
  )
}
