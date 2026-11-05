import { Router } from 'express'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import type { IMemberRepository } from '../repositories/interfaces.ts'

// Read-only directory of active members for pickers and filters, safe for every authenticated role
export function createMemberDirectoryRouter(members: IMemberRepository, authMiddleware: any): Router {
  const router = Router()
  router.use(authMiddleware)

  router.get('/directory', async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    const all = await members.findAll()
    res.status(200).json({
      members: all
        .filter((member) => member.isActive)
        .map((member) => ({
          username: member.username,
          name: member.name,
          department: member.department,
          role: member.role,
          isDepartmentHead: member.isDepartmentHead,
        })),
    })
  })

  return router
}
