import express from 'express'
import type { Express, NextFunction, Request, Response } from 'express'
import { AuthService } from './auth/authService.ts'
import { MemorySessionService } from './auth/sessionService.ts'
import type { ISessionService } from './auth/sessionService.ts'
import { CmsService } from './cms/cmsService.ts'
import type { AppConfig } from './config/environment.ts'
import { createAuthMiddleware } from './middleware/authMiddleware.ts'
import { InMemoryTicketStore } from './repositories/inMemoryTicketStore.ts'
import type { ITicketStore } from './repositories/interfaces.ts'
import { createAuthRouter } from './routes/authRoutes.ts'
import { createCmsRouter } from './routes/cmsRoutes.ts'
import { createHealthRouter } from './routes/health.ts'

export interface AppDependencies {
  readonly store?: ITicketStore
  readonly sessionService?: ISessionService
  readonly authService?: AuthService
  readonly cmsService?: CmsService
}

// Factory constructing configured Express application instance
export function createApp(config: AppConfig, deps: AppDependencies = {}): Express {
  const app = express()

  const store = deps.store ?? new InMemoryTicketStore()
  const sessionService = deps.sessionService ?? new MemorySessionService()
  const authService = deps.authService ?? new AuthService(store.members, sessionService)
  const cmsService = deps.cmsService ?? new CmsService(store)
  const authMiddleware = createAuthMiddleware(sessionService, store.members)

  // Standard JSON payload decoding
  app.use(express.json())

  // Health and diagnostics routing
  app.use('/health', createHealthRouter(config))

  // Authentication routing
  app.use('/api/auth', createAuthRouter(authService, authMiddleware))

  // General authenticated template and SLA discovery endpoints (Staff, Head, Admin)
  app.get('/api/templates', authMiddleware, async (req: Request, res: Response) => {
    const department = req.query.department as string | undefined
    const list = await cmsService.listTemplates(department, false)
    res.status(200).json({ templates: list })
  })

  app.get('/api/slas', authMiddleware, async (_req: Request, res: Response) => {
    const list = await cmsService.listDefaultSlas()
    res.status(200).json({ slas: list })
  })

  // CMS management routing
  app.use('/api/cms', createCmsRouter(cmsService, authMiddleware))

  // Explicit catch-all handler for undefined routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource does not exist.',
    })
  })

  // Centralized error handling middleware preventing uncaught exception leaks
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    res.status(500).json({
      error: 'Internal Server Error',
      message: config.nodeEnv === 'production' ? 'An unexpected error occurred.' : err.message,
    })
  })

  return app
}
