import { useEffect, useState } from 'react'
import { getHealth } from './api.ts'

export type ServerStatus = 'checking' | 'ready' | 'ollama-down' | 'server-down'

const POLL_INTERVAL_MS = 5000
const REQUEST_TIMEOUT_MS = 4000 // shorter than the interval, so checks never overlap

export function useServerStatus(): ServerStatus {
  const [status, setStatus] = useState<ServerStatus>('checking')

  useEffect(() => {
    let stopped = false

    async function check() {
      let next: ServerStatus
      try {
        const health = await getHealth(AbortSignal.timeout(REQUEST_TIMEOUT_MS))
        next = health.ollama ? 'ready' : 'ollama-down'
      } catch {
        next = 'server-down'
      }
      if (!stopped) {
        setStatus(next)
      }
    }

    void check()
    const timer = window.setInterval(check, POLL_INTERVAL_MS)

    return () => {
      stopped = true
      window.clearInterval(timer)
    }
  }, [])

  return status
}
