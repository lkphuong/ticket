// HTTP routing for dashboard summary and cross-department reports

import { Router } from 'express'
import type { Response } from 'express'
import type { Department, TicketFilters } from '@vtdesk/domain'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import { ReportAuthorizationError } from '../reports/reportService.ts'
import type { ReportService } from '../reports/reportService.ts'

// Helper converting session data to domain viewer object
function toDomainViewer(viewerData?: AuthenticatedRequest['viewer']) {
  if (!viewerData) {
    return {
      name: '',
      department: '' as Department,
      isDepartmentHead: false,
      isExecutive: false,
    }
  }
  return {
    name: viewerData.name,
    department: viewerData.department as Department,
    isDepartmentHead: viewerData.isDepartmentHead,
    isExecutive: viewerData.role === 'admin',
  }
}

export function createReportRouter(reportService: ReportService, authMiddleware: any): Router {
  const router = Router()

  router.use(authMiddleware)

  // Retrieves dashboard performance metrics
  router.get('/dashboard', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const viewer = toDomainViewer(req.viewer)
      const requestedDepartment = (req.query.department as string) || undefined

      const filters: Partial<TicketFilters> = {
        scope: req.query.scope as any,
        query: req.query.query as string,
        status: req.query.status as any,
        priority: req.query.priority as any,
        department: req.query.department as any,
        fromDepartment: req.query.fromDepartment as any,
        createdFrom: req.query.createdFrom as string,
        createdTo: req.query.createdTo as string,
        due: req.query.due as any,
        assignment: req.query.assignment as any,
        assigneeName: req.query.assigneeName as string,
      }

      const metrics = await reportService.getDashboardReport(viewer, requestedDepartment, filters)
      res.status(200).json(metrics)
    } catch (err: unknown) {
      if (err instanceof ReportAuthorizationError) {
        res.status(403).json({
          error: 'Forbidden',
          message: err.message,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: err instanceof Error ? err.message : 'Unable to generate dashboard report.',
      })
    }
  })

  // Retrieves cross-department matrix (restricted to system administrators)
  router.get('/cross-department', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const viewer = toDomainViewer(req.viewer)
      const result = await reportService.getCrossDepartmentReport(viewer)
      res.status(200).json(result)
    } catch (err: unknown) {
      if (err instanceof ReportAuthorizationError) {
        res.status(403).json({
          error: 'Forbidden',
          message: err.message,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: err instanceof Error ? err.message : 'Unable to generate cross-department report.',
      })
    }
  })

  // Alias endpoint for cross-department summary
  router.get('/departments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const viewer = toDomainViewer(req.viewer)
      const result = await reportService.getCrossDepartmentReport(viewer)
      res.status(200).json(result)
    } catch (err: unknown) {
      if (err instanceof ReportAuthorizationError) {
        res.status(403).json({
          error: 'Forbidden',
          message: err.message,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: err instanceof Error ? err.message : 'Unable to generate cross-department report.',
      })
    }
  })

  return router
}
