import type { TicketAttachment } from '../domain/ticket.ts'
import { apiClient } from './apiClient.ts'

// Saves the file under its original name by handing the fetched bytes to a temporary anchor
export async function downloadAttachment(attachment: TicketAttachment & { id: string }): Promise<void> {
  const blob = await apiClient.attachments.fetchContent(attachment.id, true)
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = attachment.name
  anchor.click()
  URL.revokeObjectURL(url)
}
