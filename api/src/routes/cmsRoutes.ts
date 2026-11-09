import { Router } from 'express'
import type { Response } from 'express'
import { CmsService, CmsValidationError } from '../cms/cmsService.ts'
import type { MemberListFilters } from '../cms/cmsService.ts'
import { parsePageRequest } from '../cms/pagination.ts'
import type { DbMember } from '../repositories/interfaces.ts'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import { requireRoles } from '../middleware/authMiddleware.ts'

const MEMBER_ROLES: readonly DbMember['role'][] = ['staff', 'head', 'admin']

function readMemberFilters(query: Record<string, unknown>): MemberListFilters {
  const role = MEMBER_ROLES.find((candidate) => candidate === query.role)
  const status = query.status === 'active' || query.status === 'locked' ? query.status : undefined
  return {
    search: typeof query.search === 'string' ? query.search : undefined,
    department: typeof query.department === 'string' && query.department ? query.department : undefined,
    role,
    status,
  }
}

// Strips credentials so password hashes never leave the API
function toMemberResponse(member: DbMember) {
  return {
    id: member.id,
    username: member.username,
    name: member.name,
    department: member.department,
    role: member.role,
    isDepartmentHead: member.isDepartmentHead,
    isActive: member.isActive,
    requiresPasswordChange: member.requiresPasswordChange,
    email: member.email,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  }
}

export function createCmsRouter(cmsService: CmsService, authMiddleware: any): Router {
  const router = Router()

  // Protect all CMS administrative endpoints strictly for Administrator role
  router.use(authMiddleware)
  router.use(requireRoles('admin'))

  // Department management
  // Plain department names for pickers that need every option rather than a page
  router.get('/departments/options', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const list = await cmsService.listDepartments()
    res.status(200).json({ departments: list })
  })

  router.get('/departments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const search = typeof req.query.search === 'string' ? req.query.search : undefined
    const page = await cmsService.listDepartmentSummaries(search, parsePageRequest(req.query))
    res.status(200).json({ departments: page.items, total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages })
  })

  router.post('/departments', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { name, codePrefix } = req.body ?? {}
      await cmsService.createDepartment(req.viewer!, name, codePrefix)
      res.status(201).json({ status: 'ok', message: 'Phòng ban đã được tạo thành công.' })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể tạo phòng ban.' })
    }
  })

  router.put('/departments/:name', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await cmsService.updateDepartment(req.viewer!, req.params.name, req.body ?? {})
      res.status(200).json({ status: 'ok', message: 'Phòng ban đã được cập nhật.' })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể cập nhật phòng ban.' })
    }
  })

  router.delete('/departments/:name', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await cmsService.deleteDepartment(req.viewer!, req.params.name)
      res.status(200).json({ status: 'ok', message: 'Phòng ban đã được xóa.' })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể xóa phòng ban.' })
    }
  })

  // Member management
  router.get('/members', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const page = await cmsService.listMembersPage(readMemberFilters(req.query), parsePageRequest(req.query))
    res.status(200).json({
      members: page.items.map(toMemberResponse),
      total: page.total,
      page: page.page,
      limit: page.limit,
      totalPages: page.totalPages,
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

  router.delete('/members/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await cmsService.deleteMember(req.viewer!, req.params.id)
      res.status(200).json({ status: 'ok', message: 'Thành viên đã được xóa.' })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể xóa thành viên.' })
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
  router.get('/audit-logs', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const page = await cmsService.listAuditLogsPage(parsePageRequest(req.query))
    res.status(200).json({ auditLogs: page.items, total: page.total, page: page.page, limit: page.limit, totalPages: page.totalPages })
  })

  // Template management (Admin only)
  router.get('/templates', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const department = req.query.department as string | undefined
    const templates = await cmsService.listTemplates(department, true)
    res.status(200).json({ templates })
  })

  router.post('/templates', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const template = await cmsService.createTemplate(req.viewer!, req.body ?? {})
      res.status(201).json({ status: 'ok', template })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể tạo mẫu yêu cầu.' })
    }
  })

  router.put('/templates/:id', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const template = await cmsService.updateTemplate(req.viewer!, req.params.id, req.body ?? {})
      res.status(200).json({ status: 'ok', template })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể cập nhật mẫu yêu cầu.' })
    }
  })

  // Default SLA management (Admin only)
  router.get('/slas', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const slas = await cmsService.listDefaultSlas()
    res.status(200).json({ slas })
  })

  router.put('/slas/:priority', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { responseHours, resolutionHours } = req.body ?? {}
      const updated = await cmsService.updateDefaultSla(
        req.viewer!,
        req.params.priority,
        Number(responseHours),
        Number(resolutionHours),
      )
      res.status(200).json({ status: 'ok', sla: updated })
    } catch (err) {
      if (err instanceof CmsValidationError) {
        res.status(400).json({ error: 'ValidationError', message: err.message })
        return
      }
      res.status(500).json({ error: 'InternalError', message: 'Không thể cập nhật SLA mặc định.' })
    }
  })

  return router
}
