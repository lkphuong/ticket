import { useState } from 'react'
import { useMemberDirectory } from '../../state/useMemberDirectory.ts'
import { PRIORITY_LABELS, STATUS_LABELS, TICKET_PRIORITIES } from '../../domain/ticket.ts'
import type { Ticket, TicketPriority, Viewer } from '../../domain/ticket.ts'
import {
  HANDLER_STATUSES,
  canAssign,
  canCancel,
  canConfirmResult,
  canEditDueDate,
  canEditPriority,
  canReopen,
  canUpdateProgress,
} from '../../lib/ticketPermissions.ts'
import { canTransition } from '../../domain/ticketTransitions.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { DatePicker } from '../ui/DatePicker.tsx'
import { Select } from '../ui/Select.tsx'

const RATING_VALUES = [1, 2, 3, 4, 5]
const RATING_LABELS: Record<number, string> = {
  1: 'Chưa đạt yêu cầu',
  2: 'Cần hoàn thiện thêm',
  3: 'Đạt yêu cầu cơ bản',
  4: 'Tốt và đúng hạn',
  5: 'Xuất sắc vượt mong đợi',
}

const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((priority) => ({
  value: priority,
  label: PRIORITY_LABELS[priority],
}))

interface TicketActionsProps {
  ticket: Ticket
  viewer: Viewer
  onAssign: (assigneeName: string) => void
  onChangeStatus: (status: Ticket['status']) => void
  onConfirm: (rating: number, feedback?: string) => void
  onReopen: (reason: string) => void
  onChangePriority?: (priority: TicketPriority) => void
  onChangeDueDate?: (dueDate: string) => void
  onCancelTicket?: (reason: string) => void
}

function AssignSection({ ticket, onAssign }: Pick<TicketActionsProps, 'ticket' | 'onAssign'>) {
  const { members, isLoading } = useMemberDirectory()
  const candidates = members.filter((member) => member.department === ticket.toDepartment)
  const [selected, setSelected] = useState(ticket.assigneeName ?? '')

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="assignee" className="text-xs font-bold text-ink uppercase tracking-wider">
        Phân công chuyên viên xử lý
      </label>
      <Select
        id="assignee"
        value={selected}
        options={candidates.map((member) => ({ value: member.name, label: `${member.name} (${member.username})` }))}
        onChange={setSelected}
        placeholder={isLoading ? 'Đang tải danh sách nhân sự...' : 'Chọn nhân sự tiếp nhận'}
      />
      <Button disabled={!selected || selected === ticket.assigneeName} onClick={() => onAssign(selected)}>
        {ticket.assigneeName ? 'Chuyển giao người xử lý' : 'Xác nhận phân công'}
      </Button>
    </div>
  )
}

function ProgressSection({ ticket, onChangeStatus }: Pick<TicketActionsProps, 'ticket' | 'onChangeStatus'>) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink uppercase tracking-wider">Cập nhật tiến trình thực hiện</p>
      <div className="flex flex-wrap gap-2">
        {HANDLER_STATUSES.map((status) => (
          <Button
            key={status}
            variant="secondary"
            disabled={ticket.status === status || !canTransition(ticket.status, status)}
            onClick={() => onChangeStatus(status)}
            className="text-xs px-3 py-1.5"
          >
            {STATUS_LABELS[status]}
          </Button>
        ))}
      </div>
    </div>
  )
}

function PrioritySection({ ticket, onChangePriority }: { ticket: Ticket; onChangePriority: (priority: TicketPriority) => void }) {
  const [priority, setPriority] = useState<TicketPriority>(ticket.priority)

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink uppercase tracking-wider">Điều chỉnh mức độ ưu tiên</p>
      <div className="flex items-center gap-2">
        <Select
          ariaLabel="Mức độ ưu tiên"
          value={priority}
          options={PRIORITY_OPTIONS}
          onChange={(value) => setPriority(value as TicketPriority)}
        />
        <Button
          variant="secondary"
          className="shrink-0 text-xs px-3 py-2"
          disabled={priority === ticket.priority}
          onClick={() => onChangePriority(priority)}
        >
          Cập nhật
        </Button>
      </div>
    </div>
  )
}

function DueDateSection({ ticket, onChangeDueDate }: { ticket: Ticket; onChangeDueDate: (dueDate: string) => void }) {
  const [date, setDate] = useState(ticket.dueDate ?? '')

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-bold text-ink uppercase tracking-wider">Gia hạn / Đổi hạn hoàn thành</p>
      <div className="flex items-center gap-2">
        <DatePicker id="extend-due-date" value={date} onChange={setDate} className="flex-1" />
        <Button
          variant="secondary"
          className="shrink-0 text-xs px-3 py-2"
          disabled={!date || date === ticket.dueDate}
          onClick={() => onChangeDueDate(date)}
        >
          Gia hạn
        </Button>
      </div>
    </div>
  )
}

function CancelSection({ onCancel }: { onCancel: (reason: string) => void }) {
  const [isOpen, setIsOpen] = useState(false)
  const [reason, setReason] = useState('')

  if (!isOpen) {
    return (
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="text-xs text-brick-700 hover:underline font-semibold self-start"
      >
        Hủy bỏ yêu cầu này
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-2.5 rounded-md border border-brick-500/30 bg-brick-100/30 p-3">
      <p className="text-xs font-bold text-brick-700 uppercase">Xác nhận hủy yêu cầu</p>
      <input
        type="text"
        placeholder="Lý do hủy yêu cầu (bắt buộc)..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className={CONTROL_CLASS}
      />
      <div className="flex items-center gap-2">
        <Button
          variant="danger"
          className="text-xs px-3 py-1.5"
          disabled={!reason.trim()}
          onClick={() => onCancel(reason.trim())}
        >
          Xác nhận hủy
        </Button>
        <button
          type="button"
          onClick={() => setIsOpen(false)}
          className="text-xs text-ink-muted hover:underline"
        >
          Quay lại
        </button>
      </div>
    </div>
  )
}

function ReopenSection({ prompt, actionLabel, onReopen }: { prompt: string; actionLabel: string; onReopen: (reason: string) => void }) {
  const [reason, setReason] = useState('')

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-ink-muted">{prompt}</p>
      <input
        type="text"
        aria-label="Lý do làm lại"
        placeholder="Lý do (bắt buộc)..."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        className={CONTROL_CLASS}
      />
      <Button variant="danger" disabled={!reason.trim()} onClick={() => onReopen(reason.trim())}>
        {actionLabel}
      </Button>
    </div>
  )
}

function ConfirmSection({
  onConfirm,
}: {
  onConfirm: (rating: number, feedback?: string) => void
}) {
  const [rating, setRating] = useState(0)
  const [feedback, setFeedback] = useState('')

  return (
    <div className="flex flex-col gap-3 rounded-md border border-moss-700/30 bg-moss-100/20 p-3">
      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs font-bold text-ink uppercase tracking-wider">
          Nghiệm thu & Đánh giá kết quả
        </legend>
        <div className="flex flex-wrap gap-1.5">
          {RATING_VALUES.map((value) => (
            <label
              key={value}
              className={`cursor-pointer rounded-md border px-3 py-1.5 text-xs font-bold transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-accent-600 ${
                rating === value
                  ? 'border-accent-600 bg-accent-600 text-white shadow-sm'
                  : 'border-line-strong bg-surface text-ink hover:bg-canvas'
              }`}
            >
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                onChange={() => setRating(value)}
                className="sr-only"
              />
              {value}
            </label>
          ))}
        </div>
        <p className="min-h-5 text-xs font-medium text-ink-muted">
          {rating ? RATING_LABELS[rating] : 'Chọn điểm từ 1 đến 5'}
        </p>
      </fieldset>

      <input
        type="text"
        placeholder="Ghi chú đánh giá thêm (tùy chọn)..."
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        className={CONTROL_CLASS}
      />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button disabled={!rating} onClick={() => onConfirm(rating, feedback.trim() || undefined)}>
          Xác nhận nghiệm thu
        </Button>
      </div>
    </div>
  )
}

export function TicketActions({
  ticket,
  viewer,
  onAssign,
  onChangeStatus,
  onConfirm,
  onReopen,
  onChangePriority,
  onChangeDueDate,
  onCancelTicket,
}: TicketActionsProps) {
  const showAssign = canAssign(ticket, viewer)
  const showProgress = canUpdateProgress(ticket, viewer)
  const showPriority = canEditPriority(ticket, viewer) && Boolean(onChangePriority)
  const showDueDate = canEditDueDate(ticket, viewer) && Boolean(onChangeDueDate)
  const showCancel = canCancel(ticket, viewer) && Boolean(onCancelTicket)
  const showConfirm = canConfirmResult(ticket, viewer)
  const showReopen = canReopen(ticket, viewer)

  if (!showAssign && !showProgress && !showConfirm && !showReopen && !showPriority && !showDueDate && !showCancel) {
    return <p className="px-4 py-4 text-xs text-ink-muted">Bạn không có quyền thao tác trên yêu cầu này.</p>
  }

  return (
    <div className="flex flex-col gap-5 px-4 py-4">
      {showAssign && <AssignSection key={ticket.assigneeName ?? 'none'} ticket={ticket} onAssign={onAssign} />}
      {showProgress && <ProgressSection ticket={ticket} onChangeStatus={onChangeStatus} />}
      {showPriority && onChangePriority && <PrioritySection ticket={ticket} onChangePriority={onChangePriority} />}
      {showDueDate && onChangeDueDate && <DueDateSection ticket={ticket} onChangeDueDate={onChangeDueDate} />}
      {showConfirm && <ConfirmSection onConfirm={onConfirm} />}
      {showReopen && (
        <ReopenSection
          prompt="Kết quả chưa đạt hoặc phát sinh thêm việc?"
          actionLabel={ticket.status === 'closed' ? 'Mở lại yêu cầu để xử lý tiếp' : 'Yêu cầu làm lại'}
          onReopen={onReopen}
        />
      )}
      {showCancel && onCancelTicket && <CancelSection onCancel={onCancelTicket} />}
    </div>
  )
}
