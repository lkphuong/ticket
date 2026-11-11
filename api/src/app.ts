import express from 'express'
import type { Express, NextFunction, Request, Response } from 'express'
import { DiskAttachmentStorage } from './attachments/attachmentStorage.ts'
import type { IAttachmentStorage } from './attachments/attachmentStorage.ts'
import { AuthService } from './auth/authService.ts'
import { OtpService } from './auth/otpService.ts'
import { MemorySessionService } from './auth/sessionService.ts'
import type { ISessionService } from './auth/sessionService.ts'
import { CmsService } from './cms/cmsService.ts'
import { DepartmentTransferService } from './members/departmentTransferService.ts'
import type { AppConfig } from './config/environment.ts'
import { createAuthMiddleware } from './middleware/authMiddleware.ts'
import { createSecurityHeaders } from './middleware/securityHeaders.ts'
import { InMemoryTicketStore } from './repositories/inMemoryTicketStore.ts'
import type { ITicketStore } from './repositories/interfaces.ts'
import { createAttachmentRouter } from './routes/attachmentRoutes.ts'
import { createAuthRouter } from './routes/authRoutes.ts'
import type { AuthRateLimitOptions } from './routes/authRoutes.ts'
import { createCmsRouter } from './routes/cmsRoutes.ts'
import { createDepartmentTransferRouter } from './routes/departmentTransferRoutes.ts'
import { createMemberDirectoryRouter } from './routes/memberDirectoryRoutes.ts'
import { createHealthRouter } from './routes/health.ts'
import { createNotificationRouter } from './routes/notificationRoutes.ts'
import { createReportRouter } from './routes/reportRoutes.ts'
import { createTicketRouter } from './routes/ticketRoutes.ts'
import { DeadlineService } from './notifications/deadlineService.ts'
import { ConsoleEmailService, MockEmailService, ResendEmailService, type IEmailService } from './notifications/emailService.ts'
import { NotificationService } from './notifications/notificationService.ts'
import { FirebasePushGateway, type IPushGateway } from './notifications/pushGateway.ts'
import { ReportService } from './reports/reportService.ts'
import { TicketService } from './tickets/ticketService.ts'

export interface AppDependencies {
  readonly store?: ITicketStore
  readonly sessionService?: ISessionService
  readonly authService?: AuthService
  readonly cmsService?: CmsService
  readonly departmentTransferService?: DepartmentTransferService
  readonly pushGateway?: IPushGateway
  readonly emailService?: IEmailService
  readonly notificationService?: NotificationService
  readonly deadlineService?: DeadlineService
  readonly reportService?: ReportService
  readonly ticketService?: TicketService
  readonly attachmentStorage?: IAttachmentStorage
  readonly authRateLimits?: AuthRateLimitOptions
}

const JSON_BODY_LIMIT = '1mb'

// Factory constructing configured Express application instance
export function createApp(config: AppConfig, deps: AppDependencies = {}): Express {
  const app = express()

  const store = deps.store ?? new InMemoryTicketStore()
  const sessionService = deps.sessionService ?? new MemorySessionService()
  const defaultEmailService = config.resendApiKey
    ? new ResendEmailService(config.resendApiKey, config.resendFromEmail)
    : config.nodeEnv === 'production'
      ? new ConsoleEmailService()
      : new MockEmailService()
  const emailService = deps.emailService ?? defaultEmailService
  const attachmentStorage = deps.attachmentStorage ?? new DiskAttachmentStorage(config.uploadDir)
  const authService = deps.authService ?? new AuthService(
      store.members,
      sessionService,
      store.departments,
      emailService,
      config.otpHmacSecret ? new OtpService(config.otpHmacSecret) : undefined,
      attachmentStorage,
    )
  const cmsService = deps.cmsService ?? new CmsService(store)
  const pushGateway = deps.pushGateway ?? new FirebasePushGateway()
  const notificationService = deps.notificationService ?? new NotificationService(store, undefined, () => new Date(), pushGateway)
  const departmentTransferService = deps.departmentTransferService ?? new DepartmentTransferService(store, notificationService)
  const deadlineService = deps.deadlineService ?? new DeadlineService(store, notificationService)
  const reportService = deps.reportService ?? new ReportService(store)
  const ticketService = deps.ticketService ?? new TicketService(store, () => new Date(), notificationService)
  const authMiddleware = createAuthMiddleware(sessionService, store.members)

  app.use(createSecurityHeaders(config.nodeEnv === 'production'))

  // Attachment content is raw bytes, so it is mounted before the JSON body parser
  app.use('/api/attachments', createAttachmentRouter(attachmentStorage, authMiddleware))

  // Standard JSON payload decoding
  app.use(express.json({ limit: JSON_BODY_LIMIT }))

  // Health and diagnostics routing
  app.use('/health', createHealthRouter(config))

  // Authentication routing
  app.use('/api/auth', createAuthRouter(authService, authMiddleware, deps.authRateLimits))

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

  // Member directory for pickers and filters
  app.use('/api/members', createMemberDirectoryRouter(store.members, authMiddleware))

  // Department transfer requests and head approvals
  app.use('/api/department-transfers', createDepartmentTransferRouter(departmentTransferService, authMiddleware))

  // CMS management routing
  app.use('/api/cms', createCmsRouter(cmsService, authMiddleware))

  // Ticket processing and query routing
  app.use('/api/tickets', createTicketRouter(store, authMiddleware, ticketService))

  // Dashboard and aggregated performance reports routing
  app.use('/api/reports', createReportRouter(reportService, authMiddleware))

  // In-app notification routing
  app.use('/api/notifications', createNotificationRouter(notificationService, authMiddleware, deadlineService))

  // Explicit catch-all handler for undefined routes
  app.use((_req: Request, res: Response) => {
    res.status(404).json({
      error: 'Not Found',
      message: 'The requested resource does not exist.',
    })
  })

  // Centralized error handling middleware preventing uncaught exception leaks
  app.use((err: Error & { type?: string }, _req: Request, res: Response, _next: NextFunction) => {
    if (err.type === 'entity.too.large') {
      res.status(413).json({ error: 'PayloadTooLarge', message: 'Request body is too large.' })
      return
    }
    res.status(500).json({
      error: 'Internal Server Error',
      message: config.nodeEnv === 'production' ? 'An unexpected error occurred.' : err.message,
    })
  })

  return app
}
