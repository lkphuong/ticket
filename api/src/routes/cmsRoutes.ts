import { Router } from 'express'
import type { Response } from 'express'
import { CmsService, CmsValidationError } from '../cms/cmsService.ts'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import { requireRoles } from '../middleware/authMiddleware.ts'

export function createCmsRouter(cmsService: CmsService, authMiddleware: any): Router {
  const router = Router()

  // Protect all CMS administrative endpoints strictly for Administrator role
  router.use(authMiddleware)
  router.use(requireRoles('admin'))

  // Department management
  router.get('/departments', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const list = await cmsService.listDepartments()
    res.status(200).json({ departments: list })
  })

  router.post('/departments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name } = req.body ?? {}
      await cmsService.createDepartment(req.viewer!, name)
      res.status(201).json({ status: 'ok', message: 'Phòng ban đã được tạo thành công.' })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể tạo phòng ban.' })
    }
  })

  // Member management
  router.get('/members', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const members = await cmsService.listMembers()
    res.status(200).json({
      members: members.map((m) => ({
        id: m.id,
        username: m.username,
        name: m.name,
        department: m.department,
        role: m.role,
        isDepartmentHead: m.isDepartmentHead,
        isActive: m.isActive,
        requiresPasswordChange: m.requiresPasswordChange,
        email: m.email,
        createdAt: m.createdAt,
        updatedAt: m.updatedAt,
      })),
    })
  })

  router.post('/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = await cmsService.createMember(req.viewer!, req.body ?? {})
      res.status(201).json({
        status: 'ok',
        member: {
          id: member.id,
          username: member.username,
          name: member.name,
          department: member.department,
          role: member.role,
          isDepartmentHead: member.isDepartmentHead,
          isActive: member.isActive,
          requiresPasswordChange: member.requiresPasswordChange,
          email: member.email,
        },
      })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể tạo thành viên.' })
    }
  })

  router.put('/members/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const member = await cmsService.updateMember(req.viewer!, req.params.id, req.body ?? {})
      res.status(200).json({
        status: 'ok',
        member: {
          id: member.id,
          username: member.username,
          name: member.name,
          department: member.department,
          role: member.role,
          isDepartmentHead: member.isDepartmentHead,
          isActive: member.isActive,
          requiresPasswordChange: member.requiresPasswordChange,
          email: member.email,
        },
      })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể cập nhật thành viên.' })
    }
  })

  router.post('/members/:id/lock', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const result = await cmsService.lockMember(req.viewer!, req.params.id)
      res.status(200).json({
        status: 'ok',
        message: 'Thành viên đã bị khóa.',
        reassignedTicketsCount: result.reassignedTicketsCount,
      })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể khóa thành viên.' })
    }
  })

  router.post('/members/:id/unlock', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await cmsService.unlockMember(req.viewer!, req.params.id)
      res.status(200).json({ status: 'ok', message: 'Thành viên đã được mở khóa.' })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể mở khóa thành viên.' })
    }
  })

  router.post('/members/:id/reset-password', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const tempPassword = await cmsService.resetPassword(req.viewer!, req.params.id, req.body?.tempPassword)
      res.status(200).json({
        status: 'ok',
        message: 'Mật khẩu đã được đặt lại thành công.',
        temporaryPassword: tempPassword,
      })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể đặt lại mật khẩu.' })
    }
  })

  // Audit logs view
  router.get('/audit-logs', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const logs = await cmsService.listAuditLogs()
    res.status(200).json({ auditLogs: logs })
  })

  return router
}
