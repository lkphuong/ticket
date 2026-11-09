// Deadline monitoring service scanning active tickets for impending and overdue milestones

import { calculateTicketSla } from '@vtdesk/domain'
import type { ITicketStore } from '../repositories/interfaces.ts'
import type { NotificationService, TicketDomainEvent } from './notificationService.ts'

const MILLISECONDS_PER_DAY = 86400000
const ISO_DATE_LENGTH = 10

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

  // Scans tickets near or past their due date and dispatches deadline notifications according to SLA rules
  async checkDeadlines(currentTime: Date = this.clock()): Promise<DeadlineCheckResult> {
    // Only tickets due tomorrow or earlier can be impending or overdue, so later ones are never loaded
    const tomorrow = new Date(currentTime.getTime() + MILLISECONDS_PER_DAY).toISOString().slice(0, ISO_DATE_LENGTH)
    const candidates = await this.store.tickets.findDeadlineCandidates(tomorrow)

    const dueEvents = candidates.flatMap((ticket): TicketDomainEvent[] => {
      const { daysDiff } = calculateTicketSla(ticket, currentTime)
      if (daysDiff === 1) return [{ type: 'deadline_impending', ticket }]
      if (daysDiff < 0) return [{ type: 'deadline_overdue', ticket }]
      return []
    })

    // Enforce once-per-ticket idempotency with one lookup per notification type
    const ticketIds = dueEvents.map((event) => event.ticket.id)
    const [alreadyImpending, alreadyOverdue] = await Promise.all([
      this.store.notifications.findExistingKeys(ticketIds, 'deadline_impending'),
      this.store.notifications.findExistingKeys(ticketIds, 'deadline_overdue'),
    ])
    const eventsToSend = dueEvents.filter(
      (event) => !(event.type === 'deadline_impending' ? alreadyImpending : alreadyOverdue).has(event.ticket.id),
    )

    await this.notificationService.dispatchMany(eventsToSend)

    return {
      scannedCount: candidates.length,
      impendingSent: eventsToSend.filter((e) => e.type === 'deadline_impending').map((e) => e.ticket.id),
      overdueSent: eventsToSend.filter((e) => e.type === 'deadline_overdue').map((e) => e.ticket.id),
    }
  }
}
