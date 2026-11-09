import type { TicketAttachment } from '../domain/ticket.ts'

const BYTES_PER_KB = 1024
const MAX_ATTACHMENT_MB = 10
const IMAGE_MIME_PREFIX = 'image/'

export const MAX_ATTACHMENT_BYTES = MAX_ATTACHMENT_MB * BYTES_PER_KB * BYTES_PER_KB

export interface PickedFile {
  file: File
  attachment: TicketAttachment
}

export interface FileSelectionResult {
  accepted: PickedFile[]
  oversizedNames: string[]
}

const PREVIEWABLE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
const PREVIEWABLE_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime']

export type AttachmentPreviewKind = 'image' | 'video'

// Mirrors the formats the API serves inline; everything else is download-only
export function getPreviewKind(mimeType: string | undefined): AttachmentPreviewKind | null {
  if (mimeType && PREVIEWABLE_IMAGE_TYPES.includes(mimeType)) return 'image'
  if (mimeType && PREVIEWABLE_VIDEO_TYPES.includes(mimeType)) return 'video'
  return null
}

export function isImageFile(file: File): boolean {
  return file.type.startsWith(IMAGE_MIME_PREFIX)
}

export function formatAttachmentSize(sizeKb: number): string {
  return sizeKb >= BYTES_PER_KB ? `${(sizeKb / BYTES_PER_KB).toFixed(1)} MB` : `${sizeKb} KB`
}

// Splits a raw selection into files that fit the size limit and the names of those that do not
export function selectAttachmentFiles(files: File[]): FileSelectionResult {
  const accepted: PickedFile[] = []
  const oversizedNames: string[] = []

  for (const file of files) {
    if (file.size > MAX_ATTACHMENT_BYTES) {
      oversizedNames.push(file.name)
      continue
    }
    accepted.push({ file, attachment: { name: file.name, sizeKb: Math.max(1, Math.round(file.size / BYTES_PER_KB)) } })
  }

  return { accepted, oversizedNames }
}

export function describeOversizedFiles(names: string[]): string {
  return `Tệp vượt quá ${MAX_ATTACHMENT_MB} MB nên không được thêm: ${names.join(', ')}`
}
