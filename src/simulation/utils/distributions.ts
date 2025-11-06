export function expSample(ratePerSec: number) {
  const u = Math.random()
  return -Math.log(1 - u) / Math.max(ratePerSec, 1e-9)
}

export function normalSample() {
  let u = 0, v = 0
  while (u === 0) u = Math.random()
  while (v === 0) v = Math.random()
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v)
}

export function lognormalSample(meanSec: number, cv: number) {
  const c2 = Math.max(cv, 1e-6) ** 2
  const sigma = Math.sqrt(Math.log(1 + c2))
  const mu = Math.log(Math.max(meanSec, 1e-6)) - 0.5 * sigma * sigma
  const z = normalSample()
  return Math.exp(mu + sigma * z)
}
