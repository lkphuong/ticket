import { Router } from 'express'
import type { Response } from 'express'
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts'
import type { NotificationService } from '../notifications/notificationService.ts'

export function createNotificationRouter(notificationService: NotificationService, authMiddleware: any): Router {
  const router = Router()

  router.use(authMiddleware)

  // Retrieves personal notification feed and unread counter
  router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const username = req.viewer!.username
      const notifications = await notificationService.listNotifications(username)
      const unreadCount = await notificationService.getUnreadCount(username)

      res.status(200).json({
        notifications,
        unreadCount,
      })
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to retrieve notifications.',
      })
    }
  })

  // Marks all notifications of current user as read
  router.patch('/read-all', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const username = req.viewer!.username
      await notificationService.markAllAsRead(username)
      res.status(200).json({ success: true })
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to mark all notifications as read.',
      })
    }
  })

  // Marks a specific notification as read
  router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      await notificationService.markAsRead(req.params.id)
      res.status(200).json({ success: true })
    } catch (err: any) {
      res.status(500).json({
        error: 'InternalError',
        message: err.message || 'Unable to mark notification as read.',
      })
    }
  })

  return router
}
