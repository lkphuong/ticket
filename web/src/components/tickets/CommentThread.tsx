import type { TicketComment } from '../../domain/ticket.ts'
import { formatDateTime } from '../../lib/formatDate.ts'
import { Avatar } from '../ui/Avatar.tsx'
import { AttachmentList } from './AttachmentList.tsx'

export function CommentThread({ comments }: { comments: TicketComment[] }) {
  if (comments.length === 0) {
    return (
      <p className="px-4 py-6 text-xs text-ink-muted">
        Chưa có trao đổi nào. Hãy gửi phản hồi hoặc tài liệu bổ sung bên dưới.
      </p>
    )
  }

  return (
    <ol className="divide-y divide-line">
      {comments.map((comment) => (
        <li key={comment.id} className="flex gap-3 px-4 py-4">
          <Avatar department={comment.department} sizeClass="mt-0.5 size-8" />
          <div className="min-w-0 flex-1">
            <p className="text-xs">
              <span className="font-semibold text-ink">{comment.author}</span>
              <span className="text-ink-muted"> · {comment.department}</span>
              <span className="ml-2 text-[11px] text-ink-muted">{formatDateTime(comment.createdAt)}</span>
            </p>
            <p className="mt-1 text-sm whitespace-pre-wrap leading-relaxed text-ink">{comment.body}</p>
            {comment.attachments && comment.attachments.length > 0 && (
              <div className="mt-2.5">
                <p className="mb-1 text-[11px] font-semibold text-ink-muted">Tệp đính kèm theo trao đổi:</p>
                <AttachmentList attachments={comment.attachments} />
              </div>
            )}
          </div>
        </li>
      ))}
    </ol>
  )
}
