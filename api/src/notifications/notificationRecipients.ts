import type { Ticket } from '@vtdesk/domain'
import type { DbMember } from '../repositories/interfaces.ts'
import type { TicketDomainEvent } from './notificationService.ts'

export interface RecipientDraft {
  readonly username: string
  readonly title: string
  readonly body: string
}

// Pre-loaded members so recipient resolution never touches the database
export interface MemberDirectory {
  findByName(name: string): DbMember | undefined
  findHead(department: string): DbMember | undefined
}

export interface DirectoryKeys {
  readonly names: string[]
  readonly departments: string[]
}

// Lists the member names and department heads any of the events may notify, so they load in two queries
export function collectDirectoryKeys(events: readonly TicketDomainEvent[]): DirectoryKeys {
  const names = new Set<string>()
  const departments = new Set<string>()
  for (const { ticket } of events) {
    names.add(ticket.requesterName)
    if (ticket.assigneeName) names.add(ticket.assigneeName)
    departments.add(ticket.toDepartment)
    departments.add(ticket.fromDepartment)
  }
  return { names: [...names], departments: [...departments] }
}

function describe(ticket: Ticket, suffix = ''): string {
  return `[${ticket.code}] ${ticket.title}${suffix}`
}

// Notifies the receiving head and the assignee, skipping the actor and never addressing the same person twice
function headAndAssignee(
  ticket: Ticket,
  directory: MemberDirectory,
  actorUsername: string | undefined,
  title: string,
  body: string,
): RecipientDraft[] {
  const recipients: RecipientDraft[] = []
  const head = directory.findHead(ticket.toDepartment)
  if (head && head.username !== actorUsername) recipients.push({ username: head.username, title, body })

  const assignee = ticket.assigneeName ? directory.findByName(ticket.assigneeName) : undefined
  if (assignee && assignee.username !== actorUsername && assignee.username !== head?.username) {
    recipients.push({ username: assignee.username, title, body })
  }
  return recipients
}

function toRecipient(member: DbMember | undefined, actorUsername: string, title: string, body: string): RecipientDraft[] {
  return member && member.username !== actorUsername ? [{ username: member.username, title, body }] : []
}

function resolveCommentRecipients(
  event: Extract<TicketDomainEvent, { type: 'comment_added' }>,
  directory: MemberDirectory,
): RecipientDraft[] {
  const { ticket } = event
  const requester = directory.findByName(ticket.requesterName)
  const body = describe(ticket, `: ${event.body}`)
  // A reply from the requester goes to the handler; a comment from anyone else goes to the requester
  if (requester && requester.username === event.commentAuthorUsername) {
    const assignee = ticket.assigneeName ? directory.findByName(ticket.assigneeName) : undefined
    return toRecipient(assignee, event.commentAuthorUsername, 'Người gửi đã phản hồi Ticket', body)
  }
  return toRecipient(requester, event.commentAuthorUsername, 'Có trao đổi mới trên Ticket', body)
}

// Pure mapping from a domain event to the people who must be notified and what they read
export function resolveRecipients(event: TicketDomainEvent, directory: MemberDirectory): RecipientDraft[] {
  const { ticket } = event
  switch (event.type) {
    case 'ticket_created':
      return toRecipient(
        directory.findHead(ticket.toDepartment),
        event.actorUsername,
        'Ticket mới gửi đến phòng',
        `[${ticket.code}] ${ticket.title} từ phòng ${ticket.fromDepartment}`,
      )
    case 'ticket_assigned': {
      const assignee = ticket.assigneeName ? directory.findByName(ticket.assigneeName) : undefined
      return toRecipient(assignee, event.actorUsername, 'Bạn được phân công xử lý Ticket', describe(ticket))
    }
    case 'status_waiting':
      return toRecipient(
        directory.findByName(ticket.requesterName),
        event.actorUsername,
        'Yêu cầu cần phản hồi thông tin',
        describe(ticket, event.reason ? `: ${event.reason}` : ''),
      )
    case 'status_resolved':
      return toRecipient(
        directory.findByName(ticket.requesterName),
        event.actorUsername,
        'Yêu cầu đã xử lý hoàn tất',
        `[${ticket.code}] ${ticket.title} đã hoàn thành, vui lòng nghiệm thu.`,
      )
    case 'comment_added':
      return resolveCommentRecipients(event, directory)
    case 'result_confirmed':
      return toRecipient(
        directory.findHead(ticket.fromDepartment),
        event.actorUsername,
        'Yêu cầu chờ bạn duyệt nghiệm thu',
        `[${ticket.code}] ${ticket.title} - Người gửi đánh giá: ${event.rating}/5 sao`,
      )
    case 'result_approved':
      return [
        ...headAndAssignee(ticket, directory, event.actorUsername, 'Yêu cầu đã được nghiệm thu', describe(ticket)),
        ...toRecipient(
          directory.findByName(ticket.requesterName),
          event.actorUsername,
          'Yêu cầu đã được Trưởng phòng duyệt nghiệm thu',
          describe(ticket),
        ),
      ]
    case 'approval_rejected':
      return [
        ...headAndAssignee(ticket, directory, event.actorUsername, 'Yêu cầu bị từ chối duyệt nghiệm thu', describe(ticket, ` - Lý do: ${event.reason}`)),
        ...toRecipient(
          directory.findByName(ticket.requesterName),
          event.actorUsername,
          'Trưởng phòng từ chối duyệt nghiệm thu',
          describe(ticket, ` - Lý do: ${event.reason}`),
        ),
      ]
    case 'ticket_rework':
      return headAndAssignee(ticket, directory, event.actorUsername, 'Yêu cầu cần làm lại', describe(ticket, ` - Lý do: ${event.reason}`))
    case 'ticket_reopened':
      return headAndAssignee(ticket, directory, event.actorUsername, 'Yêu cầu được mở lại', describe(ticket, ` - Lý do: ${event.reason}`))
    case 'ticket_cancelled':
      return [
        ...headAndAssignee(ticket, directory, event.actorUsername, 'Yêu cầu đã bị hủy', describe(ticket, ` - Lý do: ${event.reason}`)),
        ...toRecipient(
          directory.findByName(ticket.requesterName),
          event.actorUsername,
          'Yêu cầu đã bị từ chối / hủy',
          describe(ticket, ` - Lý do: ${event.reason}`),
        ),
      ]
    case 'deadline_impending':
      return headAndAssignee(
        ticket,
        directory,
        undefined,
        'Ticket sắp đến hạn',
        describe(ticket, ` còn 1 ngày đến hạn xử lý (${ticket.dueDate})`),
      )
    case 'deadline_overdue':
      return headAndAssignee(
        ticket,
        directory,
        undefined,
        'Ticket đã quá hạn',
        describe(ticket, ` đã quá hạn xử lý (${ticket.dueDate})`),
      )
  }
}
