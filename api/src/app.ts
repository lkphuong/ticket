import express from 'express'
import type { Express, Request, Response, NextFunction } from 'express'
import type { AppConfig } from './config/environment.ts'
import { createHealthRouter } from './routes/health.ts'

// Factory constructing configured Express application instance
export function createApp(config: AppConfig): Express {
  const app = express()

  // Standard JSON payload decoding
  app.use(express.json())

  // Health and diagnostics routing
  app.use('/health', createHealthRouter(config))

  // Explicit catch-all handler for undefined routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource does not exist.',
    })
  })

  // Centralized error handling middleware preventing uncaught exception leaks
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    // Log unexpected errors without exposing stack details in production
    res.status(500).json({
      error: 'Internal Server Error',
      message: config.nodeEnv === 'production' ? 'An unexpected error occurred.' : err.message,
    })
  })

  return app
}
