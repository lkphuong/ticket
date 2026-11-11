import { Router } from 'express'
import type { RequestHandler, Response } from 'express'
import { DepartmentTransferError } from '../members/departmentTransferService.ts'
import type { DepartmentTransferService } from '../members/departmentTransferService.ts'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import type { DbDepartmentTransfer } from '../repositories/interfaces.ts'

function toTransferResponse(transfer: DbDepartmentTransfer) {
  return {
    id: transfer.id,
    username: transfer.username,
    memberName: transfer.memberName,
    fromDepartment: transfer.fromDepartment,
    toDepartment: transfer.toDepartment,
    status: transfer.status,
    requestedAt: transfer.requestedAt,
    decidedAt: transfer.decidedAt,
    rejectReason: transfer.rejectReason,
  }
}

// Maps service failures to their HTTP status and passes anything unexpected to the global error handler
function handle(action: (req: AuthenticatedRequest, res: Response) => Promise<void>): RequestHandler {
  return async (req, res, next) => {
    try {
      await action(req as AuthenticatedRequest, res)
    } catch (err) {
      if (err instanceof DepartmentTransferError) {
        res.status(err.httpStatus).json({ error: err.code, message: err.message })
        return
      }
      next(err)
    }
  }
}

// Department transfer requests: members file and withdraw them, heads of the releasing department decide
export function createDepartmentTransferRouter(service: DepartmentTransferService, authMiddleware: RequestHandler): Router {
  const router = Router()
  router.use(authMiddleware)

  router.get(
    '/mine',
    handle(async (req, res) => {
      const transfer = await service.getLatestRequest(req.viewer!)
      res.status(200).json({ transfer: transfer ? toTransferResponse(transfer) : null })
    }),
  )

  router.post(
    '/',
    handle(async (req, res) => {
      const transfer = await service.requestTransfer(req.viewer!, req.body?.toDepartment)
      res.status(201).json({ transfer: toTransferResponse(transfer) })
    }),
  )

  router.delete(
    '/mine',
    handle(async (req, res) => {
      await service.cancelRequest(req.viewer!)
      res.status(200).json({ status: 'ok' })
    }),
  )

  router.get(
    '/incoming',
    handle(async (req, res) => {
      const transfers = await service.listIncoming(req.viewer!)
      res.status(200).json({ transfers: transfers.map(toTransferResponse) })
    }),
  )

  router.post(
    '/:id/approve',
    handle(async (req, res) => {
      const transfer = await service.approve(req.viewer!, req.params.id)
      res.status(200).json({ transfer: toTransferResponse(transfer) })
    }),
  )

  router.post(
    '/:id/reject',
    handle(async (req, res) => {
      const transfer = await service.reject(req.viewer!, req.params.id, req.body?.reason)
      res.status(200).json({ transfer: toTransferResponse(transfer) })
    }),
  )

  return router
}
