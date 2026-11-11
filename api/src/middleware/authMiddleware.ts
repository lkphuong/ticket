import type { NextFunction, Request, Response } from 'express'
import type { SessionData, ISessionService } from '../auth/sessionService.ts'
import type { IMemberRepository } from '../repositories/interfaces.ts'

export interface AuthenticatedRequest extends Request {
  viewer?: SessionData
  sessionToken?: string
}

// Extracts session token from headers
function extractToken(req: Request): string | null {
  const authHeader = req.headers.authorization
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim()
  }
  const customHeader = req.headers['x-session-token']
  if (typeof customHeader === 'string' && customHeader.length > 0) {
    return customHeader.trim()
  }
  return null
}

// Factory constructing authentication verification middleware
export function createAuthMiddleware(sessionService: ISessionService, memberRepo: IMemberRepository) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const token = extractToken(req)
    if (!token) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication token required.',
      })
      return
    }

    const session = await sessionService.getSession(token)
    if (!session) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired session token.',
      })
      return
    }

    // Verify member is still active in database
    const member = await memberRepo.findById(session.userId)
    if (!member || !member.isActive) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Account is deactivated or does not exist.',
      })
      return
    }

    // Attach verified viewer and token to context; organisational fields come from the member so a transfer applies at once
    req.viewer = {
      ...session,
      name: member.name,
      department: member.department,
      role: member.role,
      isDepartmentHead: member.isDepartmentHead,
    }
    req.sessionToken = token

    // The member record is the source of truth: the session snapshot goes stale once the password is changed
    if (member.requiresPasswordChange) {
      const allowedPaths = ['/api/auth/change-password', '/api/auth/me', '/api/auth/logout', '/change-password', '/me', '/logout']
      const path = req.path.toLowerCase()
      const isAllowed = allowedPaths.some((p) => path.endsWith(p))
      if (!isAllowed) {
        res.status(403).json({
          error: 'PasswordChangeRequired',
          message: 'Temporary password must be changed before accessing other resources.',
        })
        return
      }
    }

    next()
  }
}

// Role-based access control guard
export function requireRoles(...allowedRoles: Array<'staff' | 'head' | 'admin'>) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.viewer) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      })
      return
    }

    if (!allowedRoles.includes(req.viewer.role)) {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: insufficient role privileges.',
      })
      return
    }

    next()
  }
}

// Department head or administrator access guard
export function requireDepartmentHead() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.viewer) {
      res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required.',
      })
      return
    }

    if (!req.viewer.isDepartmentHead && req.viewer.role !== 'admin') {
      res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied: requires Department Head or Administrator.',
      })
      return
    }

    next()
  }
}
