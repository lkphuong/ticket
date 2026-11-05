import type { Ticket } from '@vtdesk/domain'
import type { DbNotification, ITicketStore } from '../repositories/interfaces.ts'
import type { IPushGateway } from './pushGateway.ts'

export interface INotificationChannel {
  send(notification: DbNotification): Promise<void>
}

// Null object pattern implementation for environments without external push providers
export class NoopNotificationChannel implements INotificationChannel {
  async send(_notification: DbNotification): Promise<void> {
    // Operation intentionally blank
  }
}

export type TicketDomainEvent =
  | {
      type: 'ticket_created'
      ticket: Ticket
      actorUsername: string
    }
  | {
      type: 'ticket_assigned'
      ticket: Ticket
      actorUsername: string
    }
  | {
      type: 'status_waiting'
      ticket: Ticket
      actorUsername: string
      reason?: string
    }
  | {
      type: 'status_resolved'
      ticket: Ticket
      actorUsername: string
    }
  | {
      type: 'comment_added'
      ticket: Ticket
      commentAuthorUsername: string
      body: string
    }
  | {
      type: 'result_confirmed'
      ticket: Ticket
      actorUsername: string
      rating: number
    }
  | {
      type: 'ticket_rework'
      ticket: Ticket
      actorUsername: string
      reason: string
    }
  | {
      type: 'ticket_reopened'
      ticket: Ticket
      actorUsername: string
      reason: string
    }
  | {
      type: 'ticket_cancelled'
      ticket: Ticket
      actorUsername: string
      reason: string
    }
  | {
      type: 'deadline_impending'
      ticket: Ticket
    }
  | {
      type: 'deadline_overdue'
      ticket: Ticket
    }

export class NotificationService {
  constructor(
    private readonly store: ITicketStore,
    private readonly channel: INotificationChannel = new NoopNotificationChannel(),
    private readonly clock: () => Date = () => new Date(),
    private readonly pushGateway?: IPushGateway,
  ) {}

  // Dispatches domain events into targeted recipient in-app notifications
  async dispatch(event: TicketDomainEvent): Promise<void> {
    try {
      const allMembers = await this.store.members.findAll()
      const findMemberByName = (name: string) => allMembers.find((m) => m.name === name)
      const findReceivingHead = (department: string) =>
        allMembers.find((m) => m.department === department && m.isDepartmentHead)

      const targetRecipients: Array<{ username: string; title: string; body: string }> = []
      const { ticket } = event

      switch (event.type) {
        case 'ticket_created': {
          const head = findReceivingHead(ticket.toDepartment)
          if (head && head.username !== event.actorUsername) {
            targetRecipients.push({
              username: head.username,
              title: 'Ticket mới gửi đến phòng',
              body: `[${ticket.id}] ${ticket.title} từ phòng ${ticket.fromDepartment}`,
            })
          }
          break
        }

        case 'ticket_assigned': {
          if (ticket.assigneeName) {
            const assignee = findMemberByName(ticket.assigneeName)
            if (assignee && assignee.username !== event.actorUsername) {
              targetRecipients.push({
                username: assignee.username,
                title: 'Bạn được phân công xử lý Ticket',
                body: `[${ticket.id}] ${ticket.title}`,
              })
            }
          }
          break
        }

        case 'status_waiting': {
          const requester = findMemberByName(ticket.requesterName)
          if (requester && requester.username !== event.actorUsername) {
            targetRecipients.push({
              username: requester.username,
              title: 'Yêu cầu cần phản hồi thông tin',
              body: `[${ticket.id}] ${ticket.title}${event.reason ? `: ${event.reason}` : ''}`,
            })
          }
          break
        }

        case 'status_resolved': {
          const requester = findMemberByName(ticket.requesterName)
          if (requester && requester.username !== event.actorUsername) {
            targetRecipients.push({
              username: requester.username,
              title: 'Yêu cầu đã xử lý hoàn tất',
              body: `[${ticket.id}] ${ticket.title} đã hoàn thành, vui lòng nghiệm thu.`,
            })
          }
          break
        }

        case 'comment_added': {
          // If requester replies, notify assigned handler
          const requester = findMemberByName(ticket.requesterName)
          if (requester && requester.username === event.commentAuthorUsername) {
            if (ticket.assigneeName) {
              const assignee = findMemberByName(ticket.assigneeName)
              if (assignee && assignee.username !== event.commentAuthorUsername) {
                targetRecipients.push({
                  username: assignee.username,
                  title: 'Người gửi đã phản hồi Ticket',
                  body: `[${ticket.id}] ${ticket.title}: ${event.body}`,
                })
              }
            }
          } else {
            // Specialist or head commented, notify requester
            if (requester && requester.username !== event.commentAuthorUsername) {
              targetRecipients.push({
                username: requester.username,
                title: 'Có trao đổi mới trên Ticket',
                body: `[${ticket.id}] ${ticket.title}: ${event.body}`,
              })
            }
          }
          break
        }

        case 'result_confirmed': {
          // Notify both assignee and receiving department head
          const head = findReceivingHead(ticket.toDepartment)
          if (head && head.username !== event.actorUsername) {
            targetRecipients.push({
              username: head.username,
              title: 'Yêu cầu đã được nghiệm thu',
              body: `[${ticket.id}] ${ticket.title} - Đánh giá: ${event.rating}/5 sao`,
            })
          }

          if (ticket.assigneeName) {
            const assignee = findMemberByName(ticket.assigneeName)
            if (assignee && assignee.username !== event.actorUsername && assignee.username !== head?.username) {
              targetRecipients.push({
                username: assignee.username,
                title: 'Yêu cầu đã được nghiệm thu',
                body: `[${ticket.id}] ${ticket.title} - Đánh giá: ${event.rating}/5 sao`,
              })
            }
          }
          break
        }

        case 'ticket_rework': {
          const head = findReceivingHead(ticket.toDepartment)
          if (head && head.username !== event.actorUsername) {
            targetRecipients.push({
              username: head.username,
              title: 'Yêu cầu cần làm lại',
              body: `[${ticket.id}] ${ticket.title} - Lý do: ${event.reason}`,
            })
          }

          if (ticket.assigneeName) {
            const assignee = findMemberByName(ticket.assigneeName)
            if (assignee && assignee.username !== event.actorUsername && assignee.username !== head?.username) {
              targetRecipients.push({
                username: assignee.username,
                title: 'Yêu cầu cần làm lại',
                body: `[${ticket.id}] ${ticket.title} - Lý do: ${event.reason}`,
              })
            }
          }
          break
        }

        case 'ticket_reopened': {
          const head = findReceivingHead(ticket.toDepartment)
          if (head && head.username !== event.actorUsername) {
            targetRecipients.push({
              username: head.username,
              title: 'Yêu cầu được mở lại',
              body: `[${ticket.id}] ${ticket.title} - Lý do: ${event.reason}`,
            })
          }

          if (ticket.assigneeName) {
            const assignee = findMemberByName(ticket.assigneeName)
            if (assignee && assignee.username !== event.actorUsername && assignee.username !== head?.username) {
              targetRecipients.push({
                username: assignee.username,
                title: 'Yêu cầu được mở lại',
                body: `[${ticket.id}] ${ticket.title} - Lý do: ${event.reason}`,
              })
            }
          }
          break
        }

        case 'ticket_cancelled': {
          // If cancelled by requester, notify head and assignee
          const head = findReceivingHead(ticket.toDepartment)
          if (head && head.username !== event.actorUsername) {
            targetRecipients.push({
              username: head.username,
              title: 'Yêu cầu đã bị hủy',
              body: `[${ticket.id}] ${ticket.title} - Lý do: ${event.reason}`,
            })
          }

          if (ticket.assigneeName) {
            const assignee = findMemberByName(ticket.assigneeName)
            if (assignee && assignee.username !== event.actorUsername && assignee.username !== head?.username) {
              targetRecipients.push({
                username: assignee.username,
                title: 'Yêu cầu đã bị hủy',
                body: `[${ticket.id}] ${ticket.title} - Lý do: ${event.reason}`,
              })
            }
          }

          // If cancelled by head, notify requester
          const requester = findMemberByName(ticket.requesterName)
          if (requester && requester.username !== event.actorUsername) {
            targetRecipients.push({
              username: requester.username,
              title: 'Yêu cầu đã bị từ chối / hủy',
              body: `[${ticket.id}] ${ticket.title} - Lý do: ${event.reason}`,
            })
          }
          break
        }

        case 'deadline_impending': {
          const head = findReceivingHead(ticket.toDepartment)
          if (head) {
            targetRecipients.push({
              username: head.username,
              title: 'Ticket sắp đến hạn',
              body: `[${ticket.id}] ${ticket.title} còn 1 ngày đến hạn xử lý (${ticket.dueDate})`,
            })
          }

          if (ticket.assigneeName) {
            const assignee = findMemberByName(ticket.assigneeName)
            if (assignee && assignee.username !== head?.username) {
              targetRecipients.push({
                username: assignee.username,
                title: 'Ticket sắp đến hạn',
                body: `[${ticket.id}] ${ticket.title} còn 1 ngày đến hạn xử lý (${ticket.dueDate})`,
              })
            }
          }
          break
        }

        case 'deadline_overdue': {
          const head = findReceivingHead(ticket.toDepartment)
          if (head) {
            targetRecipients.push({
              username: head.username,
              title: 'Ticket đã quá hạn',
              body: `[${ticket.id}] ${ticket.title} đã quá hạn xử lý (${ticket.dueDate})`,
            })
          }

          if (ticket.assigneeName) {
            const assignee = findMemberByName(ticket.assigneeName)
            if (assignee && assignee.username !== head?.username) {
              targetRecipients.push({
                username: assignee.username,
                title: 'Ticket đã quá hạn',
                body: `[${ticket.id}] ${ticket.title} đã quá hạn xử lý (${ticket.dueDate})`,
              })
            }
          }
          break
        }
      }

      const timestamp = this.clock().toISOString()

      // Save each notification and push through configured channels
      for (const target of targetRecipients) {
        const item: DbNotification = {
          id: `notif-${crypto.randomUUID()}`,
          recipientUsername: target.username,
          ticketId: ticket.id,
          type: event.type,
          title: target.title,
          body: target.body,
          isRead: false,
          createdAt: timestamp,
        }

        await this.store.notifications.save(item)

        // Dispatch push notification to all registered user devices
        if (this.pushGateway) {
          try {
            const userDevices = await this.store.deviceTokens.findByUsername(target.username)
            if (userDevices.length > 0) {
              const tokens = userDevices.map((d) => d.token)
              const pushResult = await this.pushGateway.sendToDevices(tokens, {
                title: target.title,
                body: target.body,
                data: ticket.id ? { ticketId: ticket.id } : undefined,
              })

              // Automatically prune rejected device tokens reported by push provider
              if (pushResult.invalidTokens && pushResult.invalidTokens.length > 0) {
                for (const invalidToken of pushResult.invalidTokens) {
                  await this.store.deviceTokens.deleteByToken(invalidToken)
                }
              }
            }
          } catch (pushErr: unknown) {
            // Push delivery errors must only be logged contextually, preserving business flow
            console.error('[NotificationService] Push delivery failed for recipient:', target.username, {
              notificationType: event.type,
              ticketId: ticket.id,
              error: pushErr instanceof Error ? pushErr.message : String(pushErr),
            })
          }
        }

        // Push notification failure must not abort persistence
        this.channel.send(item).catch((err) => {
          console.error(`[NotificationChannel] Failed to deliver push notification: ${err.message}`, {
            notificationId: item.id,
            recipient: item.recipientUsername,
          })
        })
      }
    } catch (err: any) {
      // Isolate notifications failure to preserve business transactional integrity
      console.error(`[NotificationService] Unexpected error while dispatching notification: ${err.message}`, {
        eventType: event.type,
        ticketId: event.ticket.id,
      })
    }
  }

  // Registers a device push token for an authenticated user
  async registerDeviceToken(username: string, token: string): Promise<void> {
    const trimmed = token.trim()
    if (!trimmed) {
      throw new Error('Device token cannot be empty.')
    }
    await this.store.deviceTokens.save({
      id: `dev-${crypto.randomUUID()}`,
      username,
      token: trimmed,
      createdAt: this.clock(),
    })
  }

  // Removes a registered device token when revoked or user logs out
  async unregisterDeviceToken(token: string): Promise<void> {
    const trimmed = token.trim()
    if (!trimmed) {
      return
    }
    await this.store.deviceTokens.deleteByToken(trimmed)
  }

  // Retrieves registered device tokens for a given username
  async getDeviceTokens(username: string): Promise<string[]> {
    const items = await this.store.deviceTokens.findByUsername(username)
    return items.map((i) => i.token)
  }

  // Lists notifications strictly owned by the querying user
  async listNotifications(username: string): Promise<DbNotification[]> {
    const list = await this.store.notifications.findByRecipient(username)
    return list.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }

  // Calculates unread notification count
  async getUnreadCount(username: string): Promise<number> {
    const list = await this.store.notifications.findByRecipient(username)
    return list.filter((n) => !n.isRead).length
  }

  // Marks a specific notification as read
  async markAsRead(id: string): Promise<void> {
    await this.store.notifications.markAsRead(id)
  }

  // Marks all notifications of a user as read
  async markAllAsRead(username: string): Promise<void> {
    await this.store.notifications.markAllAsRead(username)
  }
}
