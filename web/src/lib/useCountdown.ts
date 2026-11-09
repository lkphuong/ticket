import { useCallback, useEffect, useState } from 'react'

const TICK_INTERVAL_MS = 1000

export interface Countdown {
  readonly secondsLeft: number
  readonly isRunning: boolean
  // True once a countdown was ever started, so callers can tell expired from never started
  readonly hasStarted: boolean
  readonly start: (seconds: number) => void
}

// Deadline based so the remaining time stays correct even when timers are throttled in background tabs
export function useCountdown(initialSeconds = 0): Countdown {
  const [deadline, setDeadline] = useState<number | null>(() =>
    initialSeconds > 0 ? Date.now() + initialSeconds * TICK_INTERVAL_MS : null,
  )
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (deadline === null) return
    const timer = window.setInterval(() => setNow(Date.now()), TICK_INTERVAL_MS)
    return () => window.clearInterval(timer)
  }, [deadline])

  const start = useCallback((seconds: number) => {
    const startedAt = Date.now()
    setNow(startedAt)
    setDeadline(startedAt + seconds * TICK_INTERVAL_MS)
  }, [])

  const secondsLeft = deadline === null ? 0 : Math.max(0, Math.ceil((deadline - now) / TICK_INTERVAL_MS))
  return { secondsLeft, isRunning: secondsLeft > 0, hasStarted: deadline !== null, start }
}
