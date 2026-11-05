import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  AccountLockedError,
  AuthenticationError,
  AuthService,
  PasswordValidationError,
  ProfileValidationError,
} from '../auth/authService.ts'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'

export function createAuthRouter(authService: AuthService, authMiddleware: any): Router {
  const router = Router()

  router.post('/login', async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body ?? {}
      const result = await authService.login(username, password)
      res.status(200).json(result)
    } catch (err) {
      if (err instanceof AccountLockedError) {
        res.status(403).json({
          error: 'AccountLocked',
          message: err.message,
        })
        return
      }
      if (err instanceof AuthenticationError) {
        res.status(401).json({
          error: 'Unauthorized',
          message: err.message,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: 'An unexpected authentication error occurred.',
      })
    }
  })

  router.get('/me', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (!req.viewer?.userId) {
      res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
      return
    }

    const member = await authService.getMember(req.viewer.userId)
    if (!member) {
      res.status(200).json({
        user: req.viewer,
      })
      return
    }

    res.status(200).json({
      user: {
        id: member.id,
        username: member.username,
        name: member.name,
        department: member.department,
        role: member.role,
        isDepartmentHead: member.isDepartmentHead,
        requiresPasswordChange: member.requiresPasswordChange,
        email: member.email,
        receiveEmailNotifications: member.receiveEmailNotifications ?? false,
      },
    })
  })

  // Updates optional email and notification preference
  router.patch('/profile', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      if (!req.viewer?.userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      const { email, receiveEmailNotifications } = req.body ?? {}
      const updated = await authService.updateProfile(req.viewer.userId, {
        email,
        receiveEmailNotifications,
      })

      res.status(200).json({
        user: {
          id: updated.id,
          username: updated.username,
          name: updated.name,
          department: updated.department,
          role: updated.role,
          isDepartmentHead: updated.isDepartmentHead,
          requiresPasswordChange: updated.requiresPasswordChange,
          email: updated.email,
          receiveEmailNotifications: updated.receiveEmailNotifications ?? false,
        },
      })
    } catch (err) {
      if (err instanceof ProfileValidationError) {
        res.status(400).json({
          error: 'ValidationError',
          message: err.message,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: 'Unable to update profile.',
      })
    }
  })

  router.post('/change-password', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { currentPassword, newPassword } = req.body ?? {}
      if (!req.viewer?.userId) {
        res.status(401).json({ error: 'Unauthorized', message: 'Authentication required.' })
        return
      }

      await authService.changePassword(req.viewer.userId, currentPassword, newPassword)
      res.status(200).json({
        status: 'ok',
        message: 'Password successfully changed.',
      })
    } catch (err) {
      if (err instanceof PasswordValidationError) {
        res.status(400).json({
          error: 'ValidationError',
          message: err.message,
        })
        return
      }
      if (err instanceof AuthenticationError) {
        res.status(401).json({
          error: 'Unauthorized',
          message: err.message,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: 'Unable to update password.',
      })
    }
  })

  router.post('/logout', authMiddleware, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    if (req.sessionToken) {
      await authService.logout(req.sessionToken)
    }
    res.status(200).json({
      status: 'ok',
      message: 'Session terminated.',
    })
  })

  return router
}
