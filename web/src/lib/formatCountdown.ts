const SECONDS_PER_MINUTE = 60

// Formats whole seconds as mm:ss for countdown labels
export function formatCountdown(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / SECONDS_PER_MINUTE)
  const seconds = safeSeconds % SECONDS_PER_MINUTE
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}
