import type { Ticket } from '@vtdesk/domain'
import type { DbNotification, ITicketStore } from '../repositories/interfaces.ts'
import { collectDirectoryKeys, resolveRecipients } from './notificationRecipients.ts'
import type { MemberDirectory, RecipientDraft } from './notificationRecipients.ts'
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
      type: 'result_approved'
      ticket: Ticket
      actorUsername: string
    }
  | {
      type: 'approval_rejected'
      ticket: Ticket
      actorUsername: string
      reason: string
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

  // Dispatches one domain event into targeted recipient in-app notifications
  async dispatch(event: TicketDomainEvent): Promise<void> {
    await this.dispatchMany([event])
  }

  // Dispatches many events with a fixed number of database queries regardless of how many recipients they address
  async dispatchMany(events: readonly TicketDomainEvent[]): Promise<void> {
    if (events.length === 0) return
    try {
      const directory = await this.loadDirectory(events)
      const timestamp = this.clock().toISOString()
      const notifications = events.flatMap((event) =>
        resolveRecipients(event, directory).map(
          (target): DbNotification => ({
            id: crypto.randomUUID(),
            recipientUsername: target.username,
            ticketId: event.ticket.id,
            type: event.type,
            title: target.title,
            body: target.body,
            isRead: false,
            createdAt: timestamp,
          }),
        ),
      )
      await this.deliver(notifications)
    } catch (err: unknown) {
      // Isolate notifications failure to preserve business transactional integrity
      console.error(
        `[NotificationService] Unexpected error while dispatching notification: ${err instanceof Error ? err.message : String(err)}`,
        { eventTypes: [...new Set(events.map((event) => event.type))], eventCount: events.length },
      )
    }
  }

  // Notifies members about an event that is not tied to a ticket, such as a department transfer decision
  async notifyMembers(type: string, recipients: readonly RecipientDraft[]): Promise<void> {
    if (recipients.length === 0) return
    try {
      const timestamp = this.clock().toISOString()
      await this.deliver(
        recipients.map(
          (target): DbNotification => ({
            id: crypto.randomUUID(),
            recipientUsername: target.username,
            type,
            title: target.title,
            body: target.body,
            isRead: false,
            createdAt: timestamp,
          }),
        ),
      )
    } catch (err: unknown) {
      console.error(
        `[NotificationService] Unexpected error while notifying members: ${err instanceof Error ? err.message : String(err)}`,
        { type, recipientCount: recipients.length },
      )
    }
  }

  // Persists notifications, pushes them to devices and hands them to the external channel
  private async deliver(notifications: readonly DbNotification[]): Promise<void> {
    if (notifications.length === 0) return
    await this.store.notifications.saveMany(notifications)
    await this.pushToDevices(notifications)

    for (const item of notifications) {
      // Channel failure must not abort persistence
      this.channel.send(item).catch((err) => {
        console.error(`[NotificationChannel] Failed to deliver push notification: ${err.message}`, {
          notificationId: item.id,
          recipient: item.recipientUsername,
        })
      })
    }
  }

  // Loads every member the events may address in two queries and exposes them for pure lookups
  private async loadDirectory(events: readonly TicketDomainEvent[]): Promise<MemberDirectory> {
    const { names, departments } = collectDirectoryKeys(events)
    const [membersByName, heads] = await Promise.all([
      this.store.members.findByNames(names),
      this.store.members.findHeads(departments),
    ])
    return {
      findByName: (name) => membersByName.find((member) => member.name === name),
      findHead: (department) => heads.find((member) => member.department === department && member.isDepartmentHead),
    }
  }

  // Sends push messages to the registered devices of every recipient using one token lookup
  private async pushToDevices(notifications: readonly DbNotification[]): Promise<void> {
    if (!this.pushGateway) return
    const usernames = [...new Set(notifications.map((item) => item.recipientUsername))]
    const devices = await this.store.deviceTokens.findByUsernames(usernames)
    const tokensByUsername = new Map<string, string[]>()
    for (const device of devices) {
      tokensByUsername.set(device.username, [...(tokensByUsername.get(device.username) ?? []), device.token])
    }

    const invalidTokens: string[] = []
    for (const item of notifications) {
      const tokens = tokensByUsername.get(item.recipientUsername)
      if (!tokens || tokens.length === 0) continue
      try {
        const pushResult = await this.pushGateway.sendToDevices(tokens, {
          title: item.title,
          body: item.body,
          data: item.ticketId ? { ticketId: item.ticketId } : undefined,
        })
        invalidTokens.push(...(pushResult.invalidTokens ?? []))
      } catch (pushErr: unknown) {
        // Push delivery errors must only be logged contextually, preserving business flow
        console.error('[NotificationService] Push delivery failed for recipient:', item.recipientUsername, {
          notificationType: item.type,
          ticketId: item.ticketId,
          error: pushErr instanceof Error ? pushErr.message : String(pushErr),
        })
      }
    }

    // Prune rejected device tokens reported by the push provider in one delete
    await this.store.deviceTokens.deleteByTokens(invalidTokens)
  }

  // Registers a device push token for an authenticated user
  async registerDeviceToken(username: string, token: string): Promise<void> {
    const trimmed = token.trim()
    if (!trimmed) {
      throw new Error('Device token cannot be empty.')
    }
    await this.store.deviceTokens.save({
      id: crypto.randomUUID(),
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
