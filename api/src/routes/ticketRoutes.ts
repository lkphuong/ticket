import { Router } from 'express'
import type { Response } from 'express'
import {
  buildActivityLog,
  buildTicketTimeline,
  canViewTicket,
  filterTickets,
  filterVisibleTickets,
  getTicketPermissions,
} from '@vtdesk/domain'
import type {
  Department,
  TicketFilters,
  TicketPriority,
  TicketScope,
  TicketSort,
  TicketStatus,
  Viewer,
} from '@vtdesk/domain'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import type { ITicketStore } from '../repositories/interfaces.ts'
import {
  TicketAuthorizationError,
  TicketNotFoundError,
  TicketService,
  TicketValidationError,
} from '../tickets/ticketService.ts'

// Maps authenticated session into domain Viewer context
export function toDomainViewer(session: AuthenticatedRequest['viewer']): Viewer {
  if (!session) {
    throw new Error('Viewer session is required.')
  }
  return {
    name: session.name,
    department: session.department as Department,
    isDepartmentHead: session.isDepartmentHead,
    // Administrator possesses full cross-department read visibility
    isExecutive: session.role === 'admin',
  }
}

export function createTicketRouter(
  store: ITicketStore,
  authMiddleware: any,
  ticketService: TicketService = new TicketService(store),
): Router {
  const router = Router()

  router.use(authMiddleware)

  // Creates a new ticket
  router.post('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const ticket = await ticketService.createTicket(req.body, member)
      res.status(201).json({ ticket })
    } catch (err: any) {
      if (err instanceof TicketAuthorizationError) {
        res.status(403).json({
          error: 'Forbidden',
          message: err.message,
        })
        return
      }
      if (err instanceof TicketValidationError) {
        res.status(400).json({
          error: 'ValidationError',
          message: err.message,
          errors: err.errors,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to create ticket.',
      })
    }
  })

  // Retrieves filtered, search-indexed, paginated ticket collection
  router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const viewer = toDomainViewer(req.viewer)
      const allTickets = await store.tickets.findAll()

      // 1. Enforce strict authorization visibility boundaries
      const visibleTickets = filterVisibleTickets(allTickets, viewer)

      // 2. Parse query parameters into domain TicketFilters
      const filters: TicketFilters = {
        scope: (req.query.scope as TicketScope) || 'all',
        query: (req.query.query as string) || '',
        status: (req.query.status as TicketStatus | 'all') || 'all',
        priority: (req.query.priority as TicketPriority | 'all') || 'all',
        department: (req.query.department as Department | 'all') || 'all',
        fromDepartment: (req.query.fromDepartment as Department | 'all') || 'all',
        createdFrom: (req.query.createdFrom as string) || '',
        createdTo: (req.query.createdTo as string) || '',
        due: (req.query.due as any) || 'all',
        assignment: (req.query.assignment as any) || 'all',
        assigneeName: (req.query.assigneeName as string) || '',
        sort: (req.query.sort as TicketSort) || 'updated_desc',
      }

      // 3. Apply pure domain filtering and ordering
      const filteredTickets = filterTickets(visibleTickets, filters, viewer)

      // 4. Calculate stable pagination slices
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10))
      const limit = Math.max(1, Math.min(100, parseInt((req.query.limit as string) || '20', 10)))
      const total = filteredTickets.length
      const totalPages = Math.ceil(total / limit) || 1
      const offset = (page - 1) * limit
      const paginated = filteredTickets.slice(offset, offset + limit)

      res.status(200).json({
        tickets: paginated,
        total,
        page,
        limit,
        totalPages,
      })
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to retrieve tickets.',
      })
    }
  })

  // Retrieves individual ticket details with timeline, activity log, and viewer permissions
  router.get('/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const viewer = toDomainViewer(req.viewer)
      const ticketId = req.params.id
      const ticket = await store.tickets.findById(ticketId)

      // Return 404 for missing tickets or tickets outside the viewer visibility boundary
      if (!ticket || !canViewTicket(ticket, viewer)) {
        res.status(404).json({
          error: 'NotFound',
          message: 'The requested ticket does not exist or is not accessible.',
        })
        return
      }

      // Compute pure domain timeline stages
      const timeline = buildTicketTimeline(ticket)

      // Merge chronological history, comments and assignment log
      const activityLog = buildActivityLog(ticket)

      // Evaluate role-based action capabilities for current viewer
      const permissions = getTicketPermissions(ticket, viewer)

      res.status(200).json({
        ticket,
        timeline,
        activityLog,
        permissions,
      })
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to retrieve ticket details.',
      })
    }
  })

  // Assigns a specialist to handle the ticket (Receiving Department Head only)
  router.patch('/:id/assign', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { assigneeName } = req.body
      if (!assigneeName) {
        res.status(400).json({ error: 'ValidationError', message: 'Vui lòng chọn người được giao.' })
        return
      }

      const ticket = await ticketService.assignTicket(req.params.id, assigneeName, member)
      res.status(200).json({ ticket })
    } catch (err: any) {
      if (err instanceof TicketNotFoundError) {
        res.status(404).json({ error: 'NotFound', message: err.message })
        return
      }
      if (err instanceof TicketAuthorizationError) {
        res.status(403).json({ error: 'Forbidden', message: err.message })
        return
      }
      if (err instanceof TicketValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message, errors: err.errors })
        return
      }
      res.status(500).json({ error: 'InternalError', message: err.message || 'Unable to assign ticket.' })
    }
  })

  // Updates priority level of ticket
  router.patch('/:id/priority', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { priority } = req.body
      const ticket = await ticketService.updatePriority(req.params.id, priority, member)
      res.status(200).json({ ticket })
    } catch (err: any) {
      if (err instanceof TicketNotFoundError) {
        res.status(404).json({ error: 'NotFound', message: err.message })
        return
      }
      if (err instanceof TicketAuthorizationError) {
        res.status(403).json({ error: 'Forbidden', message: err.message })
        return
      }
      if (err instanceof TicketValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message, errors: err.errors })
        return
      }
      res.status(500).json({ error: 'InternalError', message: err.message || 'Unable to update priority.' })
    }
  })

  // Updates resolution due date of ticket
  router.patch('/:id/due-date', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { dueDate } = req.body
      const ticket = await ticketService.updateDueDate(req.params.id, dueDate, member)
      res.status(200).json({ ticket })
    } catch (err: any) {
      if (err instanceof TicketNotFoundError) {
        res.status(404).json({ error: 'NotFound', message: err.message })
        return
      }
      if (err instanceof TicketAuthorizationError) {
        res.status(403).json({ error: 'Forbidden', message: err.message })
        return
      }
      if (err instanceof TicketValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message, errors: err.errors })
        return
      }
      res.status(500).json({ error: 'InternalError', message: err.message || 'Unable to update due date.' })
    }
  })

  // Updates progress status of ticket (Assigned Specialist only)
  router.patch('/:id/status', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { status, reason } = req.body
      if (!status) {
        res.status(400).json({ error: 'ValidationError', message: 'Vui lòng chọn trạng thái mới.' })
        return
      }

      const ticket = await ticketService.updateProgress(req.params.id, status, member, reason)
      res.status(200).json({ ticket })
    } catch (err: any) {
      if (err instanceof TicketNotFoundError) {
        res.status(404).json({ error: 'NotFound', message: err.message })
        return
      }
      if (err instanceof TicketAuthorizationError) {
        res.status(403).json({ error: 'Forbidden', message: err.message })
        return
      }
      if (err instanceof TicketValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message, errors: err.errors })
        return
      }
      res.status(500).json({ error: 'InternalError', message: err.message || 'Unable to update status.' })
    }
  })

  // Adds a comment with optional attachments to the ticket
  router.post('/:id/comments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { body, attachments } = req.body
      const result = await ticketService.addComment(req.params.id, body, member, attachments)
      res.status(201).json(result)
    } catch (err: any) {
      if (err instanceof TicketNotFoundError) {
        res.status(404).json({ error: 'NotFound', message: err.message })
        return
      }
      if (err instanceof TicketAuthorizationError) {
        res.status(403).json({ error: 'Forbidden', message: err.message })
        return
      }
      if (err instanceof TicketValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message, errors: err.errors })
        return
      }
      res.status(500).json({ error: 'InternalError', message: err.message || 'Unable to post comment.' })
    }
  })

  return router
}
