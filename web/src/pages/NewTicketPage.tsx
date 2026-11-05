import { useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { DEPARTMENTS, PRIORITY_LABELS, TICKET_PRIORITIES } from '../domain/ticket.ts'
import type { Department, NewTicketInput } from '../domain/ticket.ts'
import { validateNewTicket } from '../lib/validateNewTicket.ts'
import type { NewTicketErrors } from '../lib/validateNewTicket.ts'
import { ENTERPRISE_TEMPLATES } from '../lib/ticketTemplates.ts'
import type { TicketTemplate } from '../lib/ticketTemplates.ts'
import { useToast } from '../lib/toastContext.ts'
import { Button } from '../components/ui/Button.tsx'
import { CONTROL_CLASS } from '../components/ui/controlStyles.ts'
import { DatePicker } from '../components/ui/DatePicker.tsx'
import { DepartmentTile } from '../components/ui/DepartmentTile.tsx'
import { FileInput } from '../components/ui/FileInput.tsx'
import { FormField } from '../components/ui/FormField.tsx'
import { PageHeader } from '../components/ui/PageHeader.tsx'
import { Select } from '../components/ui/Select.tsx'
import { toIsoDate } from '../lib/calendar.ts'
import { useTickets } from '../state/useTickets.ts'

const BYTES_PER_KB = 1024
const MILLISECONDS_IN_DAY = 86400000

const PRIORITY_OPTIONS = TICKET_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] }))

const EMPTY_INPUT: NewTicketInput = {
  title: '',
  description: '',
  purpose: '',
  expectedResult: '',
  priority: 'medium',
  toDepartment: '',
  dueDate: '',
  attachments: [],
}

export function NewTicketPage() {
  const { viewer, createTicket } = useTickets()
  const { notify } = useToast()
  const navigate = useNavigate()
  const [input, setInput] = useState<NewTicketInput>(EMPTY_INPUT)
  const [errors, setErrors] = useState<NewTicketErrors>({})
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)

  function update<Key extends keyof NewTicketInput>(key: Key, value: NewTicketInput[Key]) {
    setInput((current) => ({ ...current, [key]: value }))
  }

  function applyTemplate(template: TicketTemplate) {
    // Calculates target calendar date from suggested business turnaround days
    const suggestedTarget = new Date(Date.now() + template.suggestedDays * MILLISECONDS_IN_DAY)
    const calculatedIsoDate = toIsoDate(suggestedTarget)

    setInput({
      ...EMPTY_INPUT,
      ...template.values,
      toDepartment: template.targetDepartment,
      dueDate: calculatedIsoDate,
      attachments: input.attachments,
    })
    setSelectedTemplateId(template.id)
    setErrors({})
    notify(`Đã áp dụng mẫu: ${template.name}`, 'neutral')
  }

  function clearTemplate() {
    setInput(EMPTY_INPUT)
    setSelectedTemplateId(null)
    setErrors({})
    notify('Đã làm trống mẫu nhập liệu', 'neutral')
  }

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const rawFiles = Array.from(event.target.files ?? [])
    const newAttachments = rawFiles.map((file) => ({
      name: file.name,
      sizeKb: Math.max(1, Math.round(file.size / BYTES_PER_KB)),
    }))
    update('attachments', [...input.attachments, ...newAttachments])
  }

  function removeAttachment(index: number) {
    update(
      'attachments',
      input.attachments.filter((_, idx) => idx !== index),
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (viewer.role === 'admin' || viewer.isAdmin || viewer.isExecutive) {
      notify('Quản trị viên chỉ có quyền giám sát, không được tạo yêu cầu', 'danger')
      return
    }
    const found = validateNewTicket(input, viewer, new Date())
    setErrors(found)
    if (Object.keys(found).length > 0) {
      notify('Vui lòng kiểm tra và hoàn thiện các mục bắt buộc', 'danger')
      return
    }
    try {
      const ticket = await createTicket(input)
      notify(`Đã gửi yêu cầu ${ticket.code} thành công`, 'success')
      navigate(`/tickets/${ticket.id}`)
    } catch (err: any) {
      notify(err.message || 'Không thể tạo yêu cầu', 'danger')
    }
  }

  const departmentOptions = DEPARTMENTS.filter((department) => department !== viewer.department).map((department) => ({
    value: department,
    label: department,
    leading: <DepartmentTile department={department} />,
  }))

  return (
    <>
      <PageHeader
        title="Tạo yêu cầu hỗ trợ"
        description={`Khởi tạo yêu cầu từ phòng ${viewer.department} gửi đến phòng ban nghiệp vụ tương ứng. Trưởng phòng nhận sẽ tiếp nhận và điều phối chuyên viên xử lý.`}
      />

      <section aria-labelledby="templates-heading" className="mb-6 rounded-lg border border-line bg-surface p-4 shadow-lift">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
          <div>
            <h2 id="templates-heading" className="text-xs font-bold text-ink uppercase tracking-wider">
              Mẫu yêu cầu doanh nghiệp thường gặp
            </h2>
            <p className="text-xs text-ink-muted">Bấm chọn để tự động điền các thông tin chuẩn hoá theo quy trình:</p>
          </div>
          {selectedTemplateId && (
            <button
              type="button"
              onClick={clearTemplate}
              className="text-xs font-semibold text-accent-700 underline-offset-2 hover:underline"
            >
              Làm trống biểu mẫu
            </button>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {ENTERPRISE_TEMPLATES.map((tmpl) => {
            const isSelected = selectedTemplateId === tmpl.id
            return (
              <button
                key={tmpl.id}
                type="button"
                onClick={() => applyTemplate(tmpl)}
                className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-all ${
                  isSelected
                    ? 'border-accent-600 bg-accent-100 text-accent-800'
                    : 'border-line-strong bg-canvas text-ink hover:border-accent-600 hover:bg-surface'
                }`}
              >
                [{tmpl.targetDepartment}] {tmpl.name}
              </button>
            )
          })}
        </div>
      </section>

      <form onSubmit={handleSubmit} noValidate className="max-w-2xl rounded-lg border border-line bg-surface shadow-lift">
        <div className="flex flex-col gap-5 px-4 py-5 md:px-6">
          <FormField id="title" label="Tiêu đề yêu cầu" error={errors.title}>
            <input
              id="title"
              value={input.title}
              onChange={(event) => update('title', event.target.value)}
              aria-invalid={Boolean(errors.title)}
              aria-describedby={errors.title ? 'title-error' : undefined}
              placeholder="Ví dụ: Cấp tài khoản email và quyền VPN cho nhân sự mới"
              className={CONTROL_CLASS}
            />
          </FormField>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="toDepartment" label="Phòng ban tiếp nhận & xử lý" error={errors.toDepartment}>
              <Select<NewTicketInput['toDepartment']>
                id="toDepartment"
                value={input.toDepartment}
                options={departmentOptions}
                onChange={(value) => update('toDepartment', value as Department)}
                placeholder="Chọn phòng ban tiếp nhận"
                invalid={Boolean(errors.toDepartment)}
                describedBy={errors.toDepartment ? 'toDepartment-error' : undefined}
              />
            </FormField>
            <FormField id="priority" label="Mức độ ưu tiên">
              <Select
                id="priority"
                value={input.priority}
                options={PRIORITY_OPTIONS}
                onChange={(value) => update('priority', value)}
              />
            </FormField>
          </div>

          <FormField
            id="description"
            label="Nội dung mô tả chi tiết"
            hint="Nêu rõ phạm vi công việc cần phòng ban tiếp nhận phối hợp giải quyết."
            error={errors.description}
          >
            <textarea
              id="description"
              rows={5}
              value={input.description}
              onChange={(event) => update('description', event.target.value)}
              aria-invalid={Boolean(errors.description)}
              aria-describedby={errors.description ? 'description-error' : undefined}
              className={CONTROL_CLASS}
            />
          </FormField>

          <FormField
            id="purpose"
            label="Mục đích nghiệp vụ"
            hint="Lý do cần thực hiện yêu cầu này và công việc hoặc dự án liên quan."
            error={errors.purpose}
          >
            <textarea
              id="purpose"
              rows={2}
              value={input.purpose}
              onChange={(event) => update('purpose', event.target.value)}
              aria-invalid={Boolean(errors.purpose)}
              aria-describedby={errors.purpose ? 'purpose-error' : undefined}
              className={CONTROL_CLASS}
            />
          </FormField>

          <FormField
            id="expectedResult"
            label="Kết quả chuyển giao mong muốn"
            hint="Sản phẩm, tài liệu hoặc kết quả cụ thể khi hoàn tất yêu cầu."
            error={errors.expectedResult}
          >
            <textarea
              id="expectedResult"
              rows={2}
              value={input.expectedResult}
              onChange={(event) => update('expectedResult', event.target.value)}
              aria-invalid={Boolean(errors.expectedResult)}
              aria-describedby={errors.expectedResult ? 'expectedResult-error' : undefined}
              className={CONTROL_CLASS}
            />
          </FormField>

          <FormField
            id="dueDate"
            label="Thời hạn hoàn thành (SLA)"
            hint="Để trống nếu không có mốc thời gian bắt buộc."
            error={errors.dueDate}
          >
            <DatePicker
              id="dueDate"
              value={input.dueDate}
              onChange={(value) => update('dueDate', value)}
              min={todayIso}
              invalid={Boolean(errors.dueDate)}
              describedBy={errors.dueDate ? 'dueDate-error' : undefined}
              className="sm:max-w-56"
            />
          </FormField>

          <FormField
            id="attachments"
            label="Hồ sơ tài liệu đính kèm"
            hint="Đính kèm tối đa 5 tệp tin (hợp đồng, hóa đơn, biên bản, danh sách), tối đa 10 MB/tệp."
            error={errors.attachments}
          >
            <FileInput id="attachments" selectedCount={input.attachments.length} onChange={handleFiles} />
          </FormField>

          {input.attachments.length > 0 && (
            <div className="flex flex-col gap-2 rounded-md border border-line bg-canvas p-3">
              <span className="text-xs font-semibold text-ink">
                Danh sách tệp đính kèm ({input.attachments.length}):
              </span>
              <ul className="divide-y divide-line">
                {input.attachments.map((file, idx) => (
                  <li key={`${file.name}-${idx}`} className="flex items-center justify-between py-1.5 text-xs">
                    <span className="truncate pr-4 text-ink font-medium">
                      {file.name}
                      <span className="ml-2 text-[11px] text-ink-muted">({file.sizeKb} KB)</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="shrink-0 text-brick-700 hover:underline font-semibold"
                    >
                      Xóa tệp
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3 md:px-6">
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Hủy bỏ
          </Button>
          <Button type="submit">Gửi yêu cầu</Button>
        </div>
      </form>
    </>
  )
}
