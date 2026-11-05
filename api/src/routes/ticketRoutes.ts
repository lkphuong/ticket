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

export function createTicketRouter(store: ITicketStore, authMiddleware: any): Router {
  const router = Router()

  router.use(authMiddleware)

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

  return router
}
