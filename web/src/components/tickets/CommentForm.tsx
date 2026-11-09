import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import type { TicketAttachment } from '../../domain/ticket.ts'
import { apiClient } from '../../lib/apiClient.ts'
import { describeOversizedFiles, selectAttachmentFiles } from '../../lib/attachmentFiles.ts'
import type { PickedFile } from '../../lib/attachmentFiles.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { FileInput } from '../ui/FileInput.tsx'
import { SelectedFileList } from './SelectedFileList.tsx'

interface CommentFormProps {
  onSubmit: (body: string, attachments?: TicketAttachment[]) => void
}

export function CommentForm({ onSubmit }: CommentFormProps) {
  const [body, setBody] = useState('')
  const [pickedFiles, setPickedFiles] = useState<PickedFile[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const { accepted, oversizedNames } = selectAttachmentFiles(Array.from(event.target.files ?? []))
    setPickedFiles((current) => [...current, ...accepted])
    setFileError(oversizedNames.length > 0 ? describeOversizedFiles(oversizedNames) : null)
    // Clearing the value lets the same file be picked again after it was removed or rejected
    event.target.value = ''
  }

  function removeFile(index: number) {
    setPickedFiles((current) => current.filter((_, idx) => idx !== index))
    setFileError(null)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!body.trim()) return
    setIsUploading(true)
    try {
      const attachments = await apiClient.attachments.uploadAll(pickedFiles.map(({ file }) => file))
      onSubmit(body.trim(), attachments.length > 0 ? attachments : undefined)
      setBody('')
      setPickedFiles([])
      setFileError(null)
    } catch (error) {
      setFileError(error instanceof Error ? error.message : 'Không thể tải tệp lên.')
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 border-t border-line px-4 py-4">
      <label htmlFor="comment-body" className="text-xs font-bold text-ink uppercase tracking-wider">
        Thêm trao đổi & cập nhật tiến độ
      </label>
      <textarea
        id="comment-body"
        rows={3}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Gửi phản hồi, yêu cầu bổ sung thông tin hoặc gửi kết quả chuyển giao..."
        className={CONTROL_CLASS}
      />

      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <FileInput id="comment-attachments" selectedCount={pickedFiles.length} onChange={handleFiles} />
          <span className="text-[11px] text-ink-muted">Hồ sơ, chứng từ, hình ảnh - tối đa 10 MB/tệp (tùy chọn)</span>
        </div>
        {fileError && (
          <p role="alert" className="text-xs font-medium text-brick-700">
            {fileError}
          </p>
        )}
        <SelectedFileList files={pickedFiles} onRemove={removeFile} />
      </div>

      <Button type="submit" disabled={!body.trim() || isUploading} className="self-start">
        {isUploading ? 'Đang tải tệp lên...' : 'Gửi trao đổi'}
      </Button>
    </form>
  )
}
