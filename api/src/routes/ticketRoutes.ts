import { Router } from 'express'
import type { Response } from 'express'
import {
  buildActivityLog,
  buildTicketTimeline,
  canViewTicket,
  generateTicketsCsv,
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
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from '../cms/pagination.ts'
import type { ITicketStore } from '../repositories/interfaces.ts'
import { TicketLimitExceededError } from '../tickets/ticketLimits.ts'
import {
  TicketAuthorizationError,
  TicketNotFoundError,
  TicketService,
  TicketValidationError,
} from '../tickets/ticketService.ts'

const HTTP_UNPROCESSABLE_ENTITY = 422

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

// Reads ticket list filters from a query string, defaulting every absent filter to its neutral value
function parseTicketFilters(query: Record<string, unknown>): TicketFilters {
  return {
    scope: (query.scope as TicketScope) || 'all',
    query: (query.query as string) || '',
    status: (query.status as TicketStatus | 'all') || 'all',
    priority: (query.priority as TicketPriority | 'all') || 'all',
    department: (query.department as Department | 'all') || 'all',
    fromDepartment: (query.fromDepartment as Department | 'all') || 'all',
    createdFrom: (query.createdFrom as string) || '',
    createdTo: (query.createdTo as string) || '',
    due: (query.due as TicketFilters['due']) || 'all',
    assignment: (query.assignment as TicketFilters['assignment']) || 'all',
    assigneeName: (query.assigneeName as string) || '',
    sort: (query.sort as TicketSort) || 'updated_desc',
  }
}

// Maps ticket service failures onto their HTTP status and response shape
function respondTicketError(res: Response, err: unknown, fallbackMessage: string): void {
  if (err instanceof TicketNotFoundError) {
    res.status(404).json({ error: 'NotFound', message: err.message })
  } else if (err instanceof TicketAuthorizationError) {
    res.status(403).json({ error: 'Forbidden', message: err.message })
  } else if (err instanceof TicketValidationError) {
    res.status(400).json({ error: 'ValidationError', message: err.message, errors: err.errors })
  } else if (err instanceof TicketLimitExceededError) {
    res.status(HTTP_UNPROCESSABLE_ENTITY).json({ error: 'TicketLimitExceeded', message: err.message })
  } else {
    res.status(500).json({ error: 'InternalError', message: (err instanceof Error && err.message) || fallbackMessage })
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
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to create ticket.')
    }
  })

  // Retrieves one filtered, sorted and paginated page of the tickets the viewer may see
  router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const viewer = toDomainViewer(req.viewer)
      const page = Math.max(1, parseInt((req.query.page as string) || '1', 10))
      const limit = Math.max(1, Math.min(MAX_PAGE_SIZE, parseInt((req.query.limit as string) || String(DEFAULT_PAGE_SIZE), 10)))

      const { items, total } = await store.tickets.findPage(
        { viewer, filters: parseTicketFilters(req.query), now: new Date() },
        { page, limit },
      )

      res.status(200).json({
        tickets: items,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
      })
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to retrieve tickets.',
      })
    }
  })

  // Exports filtered visible tickets to CSV with UTF-8 BOM
  router.get('/export', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const viewer = toDomainViewer(req.viewer)
      const tickets = await store.tickets.findMatching({ viewer, filters: parseTicketFilters(req.query), now: new Date() })

      res.setHeader('Content-Type', 'text/csv; charset=utf-8')
      res.setHeader('Content-Disposition', 'attachment; filename="tickets.csv"')
      res.status(200).send(generateTicketsCsv(tickets))
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to export tickets.',
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
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to assign ticket.')
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
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to update priority.')
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
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to update due date.')
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
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to update status.')
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
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to post comment.')
    }
  })

  // Approves a confirmed result and closes the ticket (head of the requesting department only)
  router.post('/:id/approve', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const ticket = await ticketService.approveTicket(req.params.id, member)
      res.status(200).json({ ticket })
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to approve ticket.')
    }
  })

  // Rejects a confirmed result and sends the ticket back to work (head of the requesting department only)
  router.post('/:id/reject-approval', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { reason } = req.body
      const ticket = await ticketService.rejectApproval(req.params.id, reason, member)
      res.status(200).json({ ticket })
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to reject approval.')
    }
  })

  // First acceptance step: confirms ticket resolution with CSAT rating and feedback (Requester only)
  router.post('/:id/confirm', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { rating, feedback } = req.body
      const ticket = await ticketService.confirmTicket(req.params.id, rating, feedback, member)
      res.status(200).json({ ticket })
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to confirm ticket.')
    }
  })

  // Requests rework on a resolved ticket (Requester only)
  router.post('/:id/rework', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { reason } = req.body
      const ticket = await ticketService.reworkTicket(req.params.id, reason, member)
      res.status(200).json({ ticket })
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to request rework.')
    }
  })

  // Reopens a closed ticket within 7-day limit (Requester only)
  router.post('/:id/reopen', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { reason } = req.body
      const ticket = await ticketService.reopenTicket(req.params.id, reason, member)
      res.status(200).json({ ticket })
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to reopen ticket.')
    }
  })

  // Cancels an active ticket with mandatory reason (Requester or Receiving Head)
  router.post('/:id/cancel', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = req.viewer
      if (!member) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { reason } = req.body
      const ticket = await ticketService.cancelTicket(req.params.id, reason, member)
      res.status(200).json({ ticket })
    } catch (err: unknown) {
      respondTicketError(res, err, 'Unable to cancel ticket.')
    }
  })

  return router
}
