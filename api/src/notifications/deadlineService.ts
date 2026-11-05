// Deadline monitoring service scanning active tickets for impending and overdue milestones

import { calculateTicketSla } from '@vtdesk/domain'
import type { ITicketStore } from '../repositories/interfaces.ts'
import type { NotificationService } from './notificationService.ts'

export interface DeadlineCheckResult {
  readonly scannedCount: number
  readonly impendingSent: string[]
  readonly overdueSent: string[]
}

export class DeadlineService {
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(
    private readonly store: ITicketStore,
    private readonly notificationService: NotificationService,
    private readonly clock: () => Date = () => new Date(),
  ) {}

  // Starts the hourly periodic deadline checking background loop
  startHourlySchedule(intervalMs: number = 3600000): void {
    if (this.timer) {
      return
    }
    this.timer = setInterval(() => {
      this.checkDeadlines().catch((err: unknown) => {
        // Scheduled errors are logged contextually to prevent process failure
        console.error('[DeadlineService] Scheduled check encountered an error:', err)
      })
    }, intervalMs)
  }

  // Stops the background timer safely
  stopHourlySchedule(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  // Scans all active tickets and dispatches deadline notifications according to SLA rules
  async checkDeadlines(currentTime: Date = this.clock()): Promise<DeadlineCheckResult> {
    const allTickets = await this.store.tickets.findAll()
    const impendingSent: string[] = []
    const overdueSent: string[] = []

    for (const ticket of allTickets) {
      // 1. Skip tickets without due date or completed tickets (closed, resolved)
      if (!ticket.dueDate || ticket.status === 'closed' || ticket.status === 'resolved') {
        continue
      }

      // 2. SLA pauses during waiting state; skip warnings while paused
      if (ticket.status === 'waiting') {
        continue
      }

      // 3. Compute domain SLA metrics using injected clock
      const sla = calculateTicketSla(ticket, currentTime)

      // 4. Case: Impending deadline (exactly 1 day remaining)
      if (sla.daysDiff === 1) {
        // Enforce once-per-ticket idempotency rule to prevent redundant alerts
        const existingImpending = await this.store.notifications.findByTicketAndType(ticket.id, 'deadline_impending')
        if (existingImpending.length === 0) {
          await this.notificationService.dispatch({
            type: 'deadline_impending',
            ticket,
          })
          impendingSent.push(ticket.id)
        }
      }

      // 5. Case: Overdue deadline (past due date)
      if (sla.daysDiff < 0) {
        // Enforce once-per-ticket idempotency rule to prevent redundant alerts
        const existingOverdue = await this.store.notifications.findByTicketAndType(ticket.id, 'deadline_overdue')
        if (existingOverdue.length === 0) {
          await this.notificationService.dispatch({
            type: 'deadline_overdue',
            ticket,
          })
          overdueSent.push(ticket.id)
        }
      }
    }

    return {
      scannedCount: allTickets.length,
      impendingSent,
      overdueSent,
    }
  }
}
