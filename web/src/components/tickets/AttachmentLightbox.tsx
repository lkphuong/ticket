import { useEffect, useRef } from 'react'
import type { TicketAttachment } from '../../domain/ticket.ts'
import { getPreviewKind } from '../../lib/attachmentFiles.ts'
import { IconButton } from '../ui/IconButton.tsx'
import { useAttachmentObjectUrl } from './useAttachmentObjectUrl.ts'

interface AttachmentLightboxProps {
  attachment: TicketAttachment & { id: string }
  onClose: () => void
  onDownload: () => void
}

// A native modal dialog supplies focus trapping, the backdrop and Escape handling
export function AttachmentLightbox({ attachment, onClose, onDownload }: AttachmentLightboxProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const { url, failed } = useAttachmentObjectUrl(attachment.id)
  const kind = getPreviewKind(attachment.mimeType)

  useEffect(() => {
    dialogRef.current?.showModal()
  }, [])

  return (
    <dialog
      ref={dialogRef}
      aria-label={`Xem trước ${attachment.name}`}
      onClose={onClose}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose()
      }}
      className="m-auto w-[min(92vw,64rem)] rounded-lg border border-line bg-surface p-0 text-ink backdrop:bg-black/60"
    >
      <div className="flex items-center gap-2 border-b border-line px-4 py-2">
        <p className="min-w-0 flex-1 truncate text-sm font-semibold" title={attachment.name}>
          {attachment.name}
        </p>
        <IconButton icon="download" label={`Tải xuống ${attachment.name}`} onClick={onDownload} />
        <IconButton icon="x" label="Đóng xem trước" onClick={onClose} />
      </div>
      <div className="flex max-h-[75vh] min-h-48 items-center justify-center bg-canvas p-2">
        {failed && <p className="text-sm text-brick-700">Không thể tải bản xem trước. Hãy tải tệp về để xem.</p>}
        {!failed && !url && <p className="text-sm text-ink-muted">Đang tải...</p>}
        {url && kind === 'image' && <img src={url} alt={attachment.name} className="max-h-[72vh] max-w-full object-contain" />}
        {url && kind === 'video' && <video src={url} controls className="max-h-[72vh] max-w-full" />}
      </div>
    </dialog>
  )
}
