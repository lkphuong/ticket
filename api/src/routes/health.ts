import { Router } from 'express'
import { ACTIVE_STATUSES } from '@vtdesk/domain'
import type { AppConfig } from '../config/environment.ts'

// Constructs router handling liveness and diagnostics probes
export function createHealthRouter(config: AppConfig): Router {
  const router = Router()

  router.get('/', (_req, res) => {
    // Deliver explicit operational telemetry to orchestrator and monitoring agents
    res.status(200).json({
      status: 'ok',
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
      domain: {
        activeStatuses: ACTIVE_STATUSES,
      },
    })
  })

  return router
}
