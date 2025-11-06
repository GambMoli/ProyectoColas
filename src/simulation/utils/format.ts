export function formatSec(s: number) {
  if (!isFinite(s) || s <= 0) return '0s'
  if (s < 60) return `${s.toFixed(1)}s`
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}m ${r.toFixed(0)}s`
}
