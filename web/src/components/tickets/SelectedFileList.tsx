import { useEffect, useMemo } from 'react'
import { formatAttachmentSize, isImageFile } from '../../lib/attachmentFiles.ts'
import type { PickedFile } from '../../lib/attachmentFiles.ts'
import { Icon } from '../ui/Icon.tsx'
import { IconButton } from '../ui/IconButton.tsx'

interface SelectedFileListProps {
  files: PickedFile[]
  onRemove: (index: number) => void
}

// Object URLs are created per render of the selection and revoked when it changes, so previews never leak memory
function useImagePreviewUrls(files: PickedFile[]): (string | null)[] {
  const urls = useMemo(
    () => files.map(({ file }) => (isImageFile(file) ? URL.createObjectURL(file) : null)),
    [files],
  )

  useEffect(
    () => () => {
      urls.forEach((url) => {
        if (url) URL.revokeObjectURL(url)
      })
    },
    [urls],
  )

  return urls
}

export function SelectedFileList({ files, onRemove }: SelectedFileListProps) {
  const previewUrls = useImagePreviewUrls(files)

  if (files.length === 0) return null

  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {files.map(({ attachment }, index) => (
        <li key={`${attachment.name}-${index}`} className="flex items-center gap-3 rounded-md border border-line bg-canvas p-2">
          {previewUrls[index] ? (
            <img src={previewUrls[index]} alt={`Xem trước ${attachment.name}`} className="size-12 shrink-0 rounded border border-line object-cover" />
          ) : (
            <span aria-hidden="true" className="flex size-12 shrink-0 items-center justify-center rounded border border-line bg-surface text-ink-muted">
              <Icon name="file" className="size-5" />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-ink" title={attachment.name}>
              {attachment.name}
            </p>
            <p className="text-[11px] text-ink-muted">{formatAttachmentSize(attachment.sizeKb)}</p>
          </div>
          <IconButton icon="x" tone="danger" label={`Xóa tệp ${attachment.name}`} onClick={() => onRemove(index)} />
        </li>
      ))}
    </ul>
  )
}
