import { useState } from 'react'
import type { TicketAttachment } from '../../domain/ticket.ts'
import { formatAttachmentSize, getPreviewKind } from '../../lib/attachmentFiles.ts'
import { downloadAttachment } from '../../lib/downloadAttachment.ts'
import { useToast } from '../../lib/toastContext.ts'
import { Icon } from '../ui/Icon.tsx'
import { IconButton } from '../ui/IconButton.tsx'
import { AttachmentLightbox } from './AttachmentLightbox.tsx'
import { useAttachmentObjectUrl } from './useAttachmentObjectUrl.ts'

type StoredAttachment = TicketAttachment & { id: string }

const THUMBNAIL_CLASS = 'flex size-12 shrink-0 items-center justify-center overflow-hidden rounded border border-line bg-surface text-ink-muted'

function hasStoredContent(attachment: TicketAttachment): attachment is StoredAttachment {
  return Boolean(attachment.id)
}

function AttachmentThumbnail({ attachment, onOpen }: { attachment: StoredAttachment; onOpen: () => void }) {
  const kind = getPreviewKind(attachment.mimeType)
  const { url } = useAttachmentObjectUrl(attachment.id, kind === 'image')

  if (!kind) {
    return (
      <span aria-hidden="true" className={THUMBNAIL_CLASS}>
        <Icon name="file" className="size-5" />
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`Xem ${attachment.name}`}
      className={`${THUMBNAIL_CLASS} transition-colors hover:border-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40`}
    >
      {kind === 'image' && url ? <img src={url} alt="" className="size-full object-cover" /> : <Icon name={kind === 'video' ? 'play' : 'file'} className="size-5" />}
    </button>
  )
}

export function AttachmentList({ attachments }: { attachments: TicketAttachment[] }) {
  const { notify } = useToast()
  const [previewing, setPreviewing] = useState<StoredAttachment | null>(null)

  async function download(attachment: StoredAttachment) {
    try {
      await downloadAttachment(attachment)
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Không thể tải tệp xuống.', 'error')
    }
  }

  if (attachments.length === 0) return <p className="text-sm text-ink-muted">Không có tệp đính kèm.</p>

  return (
    <>
      <ul className="flex flex-col gap-1.5">
        {attachments.map((file, index) => (
          <li key={file.id ?? `${file.name}-${index}`} className="flex items-center gap-3 rounded-md border border-line px-3 py-2 text-sm">
            {hasStoredContent(file) && <AttachmentThumbnail attachment={file} onOpen={() => setPreviewing(file)} />}
            <span className="min-w-0 flex-1 truncate font-medium text-ink" title={file.name}>
              {file.name}
            </span>
            <span className="shrink-0 text-xs text-ink-muted">{formatAttachmentSize(file.sizeKb)}</span>
            {hasStoredContent(file) && <IconButton icon="download" label={`Tải xuống ${file.name}`} onClick={() => download(file)} />}
          </li>
        ))}
      </ul>
      {previewing && <AttachmentLightbox attachment={previewing} onClose={() => setPreviewing(null)} onDownload={() => download(previewing)} />}
    </>
  )
}
