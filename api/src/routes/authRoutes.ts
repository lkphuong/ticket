import { Router } from 'express'
import type { Request, Response } from 'express'
import {
  AccountLockedError,
  AccountNotVerifiedError,
  AuthenticationError,
  AuthService,
  PasswordValidationError,
  ProfileValidationError,
  RegistrationValidationError,
} from '../auth/authService.ts'
import { VerificationError } from '../auth/verificationErrors.ts'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import { createRateLimiter, resolveAccountIdentifierKey, resolveClientAddressKey } from '../middleware/rateLimiter.ts'

const RETRY_AFTER_HEADER = 'Retry-After'
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS_PER_ADDRESS = 60
const MAX_REQUESTS_PER_ACCOUNT = 10
const ACCOUNT_IDENTIFIER_FIELDS = ['username', 'identifier', 'email'] as const

export interface AuthRateLimitOptions {
  readonly windowMs: number
  readonly maxRequestsPerAddress: number
  readonly maxRequestsPerAccount: number
}

const DEFAULT_RATE_LIMITS: AuthRateLimitOptions = {
  windowMs: RATE_LIMIT_WINDOW_MS,
  maxRequestsPerAddress: MAX_REQUESTS_PER_ADDRESS,
  maxRequestsPerAccount: MAX_REQUESTS_PER_ACCOUNT,
}

// One limiter pair per public endpoint so a burst on login does not lock out verification
function createPublicEndpointLimiters(scope: string, limits: AuthRateLimitOptions) {
  return [
    createRateLimiter({
      windowMs: limits.windowMs,
      maxRequests: limits.maxRequestsPerAddress,
      resolveKey: resolveClientAddressKey(scope),
    }),
    createRateLimiter({
      windowMs: limits.windowMs,
      maxRequests: limits.maxRequestsPerAccount,
      resolveKey: resolveAccountIdentifierKey(scope, ACCOUNT_IDENTIFIER_FIELDS),
    }),
  ]
}

// Writes a verification failure with its own status, code and details; returns false for unrelated errors
function respondVerificationError(res: Response, err: unknown): boolean {
  if (!(err instanceof VerificationError)) return false
  if (typeof err.details.retryAfterSeconds === 'number') {
    res.setHeader(RETRY_AFTER_HEADER, String(err.details.retryAfterSeconds))
  }
  res.status(err.httpStatus).json({ error: err.code, message: err.message, ...err.details })
  return true
}

export function createAuthRouter(
  authService: AuthService,
  authMiddleware: any,
  rateLimits: AuthRateLimitOptions = DEFAULT_RATE_LIMITS,
): Router {
  const router = Router()

  router.post('/login', ...createPublicEndpointLimiters('login', rateLimits), async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, password } = req.body ?? {}
      const result = await authService.login(username, password)
      res.status(200).json(result)
    } catch (err) {
      if (err instanceof AccountNotVerifiedError) {
        res.status(403).json({
          error: 'AccountNotVerified',
          message: err.message,
        })
        return
      }
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

  // Handles public self-registration with organizational rules and email verification dispatch
  router.post('/register', ...createPublicEndpointLimiters('register', rateLimits), async (req: Request, res: Response): Promise<void> => {
    try {
      const { username, name, department, role, email, password } = req.body ?? {}
      const result = await authService.register({
        username,
        name,
        department,
        role,
        email,
        password,
      })
      res.status(201).json(result)
    } catch (err) {
      if (err instanceof RegistrationValidationError) {
        res.status(400).json({
          error: 'ValidationError',
          message: err.message,
        })
        return
      }
      res.status(500).json({
        error: 'InternalError',
        message: 'Không thể đăng ký tài khoản lúc này. Vui lòng thử lại sau.',
      })
    }
  })

  // Confirms verification security token and activates the account for login
  router.post('/verify-email', ...createPublicEndpointLimiters('verify-email', rateLimits), async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, identifier, email, username } = req.body ?? {}
      const result = await authService.verifyEmail(token, identifier || email || username)
      res.status(200).json({
        status: 'ok',
        message: 'Tài khoản đã được xác thực thành công. Bạn có thể đăng nhập ngay.',
        user: result,
      })
    } catch (err) {
      if (respondVerificationError(res, err)) return
      res.status(500).json({
        error: 'InternalError',
        message: 'Không thể xác thực email lúc này. Vui lòng thử lại sau.',
      })
    }
  })

  // Re-emits a fresh verification code for pending registrations, at most once per cooldown window
  router.post('/resend-verification', ...createPublicEndpointLimiters('resend-verification', rateLimits), async (req: Request, res: Response): Promise<void> => {
    try {
      const { identifier } = req.body ?? {}
      await authService.resendVerification(identifier)
      res.status(200).json({
        status: 'ok',
        message: 'Nếu thông tin tài khoản hợp lệ và chưa kích hoạt, email xác thực đã được gửi lại.',
      })
    } catch (err) {
      if (respondVerificationError(res, err)) return
      res.status(500).json({
        error: 'InternalError',
        message: 'Không thể gửi lại email xác thực lúc này.',
      })
    }
  })

  // Exposes departments and active head occupancy for public registration pickers
  router.get('/departments', async (_req: Request, res: Response): Promise<void> => {
    try {
      const departments = await authService.getPublicDepartments()
      const occupiedDepartmentHeads = await authService.getDepartmentHeadStatus()
      res.status(200).json({
        departments,
        occupiedDepartmentHeads,
      })
    } catch {
      res.status(500).json({
        error: 'InternalError',
        message: 'Không thể tải danh sách phòng ban.',
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
