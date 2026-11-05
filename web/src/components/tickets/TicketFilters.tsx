import { useState } from 'react'
import {
  DEPARTMENTS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
} from '../../domain/ticket.ts'
import type { TicketPriority, TicketStatus } from '../../domain/ticket.ts'
import { MEMBERS } from '../../data/members.ts'
import { formatDate } from '../../lib/formatDate.ts'
import { DEFAULT_TICKET_FILTERS } from '../../lib/ticketFilters.ts'
import type {
  AssignmentFilter,
  DueFilter,
  TicketFilters as TicketFiltersState,
  TicketScope,
  TicketSort,
} from '../../lib/ticketFilters.ts'
import { Button } from '../ui/Button.tsx'
import { CONTROL_CLASS } from '../ui/controlStyles.ts'
import { DatePicker } from '../ui/DatePicker.tsx'
import { DepartmentTile } from '../ui/DepartmentTile.tsx'
import { Icon } from '../ui/Icon.tsx'
import { Select } from '../ui/Select.tsx'

const SCOPE_OPTIONS: { value: TicketScope; label: string }[] = [
  { value: 'all', label: 'Tất cả yêu cầu' },
  { value: 'received', label: 'Gửi đến phòng tôi' },
  { value: 'sent', label: 'Tôi đã gửi' },
  { value: 'assigned', label: 'Giao cho tôi xử lý' },
]

const STATUS_OPTIONS = [
  { value: 'all' as const, label: 'Mọi trạng thái' },
  ...TICKET_STATUSES.map((status) => ({ value: status, label: STATUS_LABELS[status] })),
]

const PRIORITY_OPTIONS = [
  { value: 'all' as const, label: 'Mọi mức ưu tiên' },
  ...TICKET_PRIORITIES.map((priority) => ({ value: priority, label: PRIORITY_LABELS[priority] })),
]

function buildDepartmentOptions(allLabel: string) {
  return [
    { value: 'all' as const, label: allLabel },
    ...DEPARTMENTS.map((department) => ({
      value: department,
      label: department,
      leading: <DepartmentTile department={department} />,
    })),
  ]
}

const TO_DEPARTMENT_OPTIONS = buildDepartmentOptions('Mọi phòng ban tiếp nhận')
const FROM_DEPARTMENT_OPTIONS = buildDepartmentOptions('Mọi phòng ban gửi')

const DUE_OPTIONS: { value: DueFilter; label: string }[] = [
  { value: 'all', label: 'Mọi thời hạn' },
  { value: 'overdue', label: 'Quá hạn xử lý' },
  { value: 'due_today', label: 'Hết hạn hôm nay' },
  { value: 'on_track', label: 'Còn trong hạn' },
]

const ANY_ASSIGNEE_VALUE = ''
const ASSIGNEE_OPTIONS = [
  { value: ANY_ASSIGNEE_VALUE, label: 'Mọi người xử lý' },
  ...MEMBERS.filter((member) => !member.isExecutive && member.username !== 'admin').map((member) => ({ value: member.name, label: member.name })),
]

const ASSIGNMENT_OPTIONS: { value: AssignmentFilter; label: string }[] = [
  { value: 'all', label: 'Mọi phân công' },
  { value: 'unassigned', label: 'Chưa phân công' },
  { value: 'assigned', label: 'Đã có người xử lý' },
]

const SORT_OPTIONS: { value: TicketSort; label: string }[] = [
  { value: 'updated_desc', label: 'Mới cập nhật gần nhất' },
  { value: 'due_asc', label: 'Sắp hết hạn xử lý trước' },
  { value: 'priority_desc', label: 'Mức ưu tiên cao nhất' },
  { value: 'created_desc', label: 'Ngày tạo mới nhất' },
]

interface TicketFiltersProps {
  filters: TicketFiltersState
  onChange: (next: TicketFiltersState) => void
  onExportCsv?: () => void
}

interface ActiveChip {
  key: keyof TicketFiltersState
  label: string
  // Fields restored to defaults when the chip is dismissed
  reset: Partial<TicketFiltersState>
}

const FIELD_LABEL_CLASS = 'mb-1 block text-xs font-semibold text-ink-muted'

function labelOf<Value extends string>(options: { value: Value; label: string }[], value: Value): string {
  return options.find((option) => option.value === value)?.label ?? value
}

// Lists every filter that differs from its default so the viewer can see and remove it at a glance
function describeActiveFilters(filters: TicketFiltersState): ActiveChip[] {
  const chips: ActiveChip[] = []
  const defaults = DEFAULT_TICKET_FILTERS
  const query = filters.query.trim()
  if (query) chips.push({ key: 'query', label: `Từ khóa: ${query}`, reset: { query: '' } })
  if (filters.status !== defaults.status) {
    chips.push({ key: 'status', label: STATUS_LABELS[filters.status as TicketStatus], reset: { status: 'all' } })
  }
  if (filters.priority !== defaults.priority) {
    chips.push({ key: 'priority', label: `Ưu tiên ${PRIORITY_LABELS[filters.priority as TicketPriority].toLowerCase()}`, reset: { priority: 'all' } })
  }
  if (filters.fromDepartment !== defaults.fromDepartment) {
    chips.push({ key: 'fromDepartment', label: `Gửi từ ${filters.fromDepartment}`, reset: { fromDepartment: 'all' } })
  }
  if (filters.department !== defaults.department) {
    chips.push({ key: 'department', label: `Gửi đến ${filters.department}`, reset: { department: 'all' } })
  }
  if (filters.createdFrom) {
    chips.push({ key: 'createdFrom', label: `Tạo từ ${formatDate(filters.createdFrom)}`, reset: { createdFrom: '' } })
  }
  if (filters.createdTo) {
    chips.push({ key: 'createdTo', label: `Tạo đến ${formatDate(filters.createdTo)}`, reset: { createdTo: '' } })
  }
  if (filters.due !== defaults.due) {
    chips.push({ key: 'due', label: labelOf(DUE_OPTIONS, filters.due ?? 'all'), reset: { due: 'all' } })
  }
  if (filters.assignment !== defaults.assignment) {
    chips.push({ key: 'assignment', label: labelOf(ASSIGNMENT_OPTIONS, filters.assignment ?? 'all'), reset: { assignment: 'all' } })
  }
  if (filters.assigneeName) {
    chips.push({ key: 'assigneeName', label: `Xử lý: ${filters.assigneeName}`, reset: { assigneeName: '' } })
  }
  return chips
}

export function TicketFilters({ filters, onChange, onExportCsv }: TicketFiltersProps) {
  const chips = describeActiveFilters(filters)
  const advancedCount = chips.filter((chip) => chip.key !== 'query').length
  const [advancedOpen, setAdvancedOpen] = useState(advancedCount > 0)

  function update<Key extends keyof TicketFiltersState>(key: Key, value: TicketFiltersState[Key]) {
    onChange({ ...filters, [key]: value })
  }

  function handleReset() {
    onChange({ ...DEFAULT_TICKET_FILTERS, scope: filters.scope, sort: filters.sort })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div role="tablist" aria-label="Phạm vi yêu cầu" className="flex flex-wrap gap-1">
          {SCOPE_OPTIONS.map((option) => {
            const selected = filters.scope === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => update('scope', option.value)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  selected ? 'bg-accent-600 text-white shadow-sm' : 'text-ink-muted hover:bg-ash-200'
                }`}
              >
                {option.label}
              </button>
            )
          })}
        </div>
        {onExportCsv && (
          <Button variant="secondary" className="gap-1.5 px-3 py-1 text-xs font-semibold" onClick={onExportCsv}>
            <Icon name="download" className="size-3.5" />
            Xuất CSV
          </Button>
        )}
      </div>

      <div className="grid gap-2.5 sm:grid-cols-[minmax(0,1fr)_auto_14rem]">
        <input
          type="search"
          aria-label="Tìm theo mã, tiêu đề, người gửi, người xử lý, phòng ban hoặc nội dung"
          placeholder="Tìm mã, tiêu đề, người gửi, người xử lý, phòng ban, nội dung..."
          value={filters.query}
          onChange={(event) => update('query', event.target.value)}
          className={CONTROL_CLASS}
        />
        <Button
          variant="secondary"
          aria-expanded={advancedOpen}
          aria-controls="advanced-filters"
          onClick={() => setAdvancedOpen((open) => !open)}
        >
          Bộ lọc nâng cao{advancedCount > 0 ? ` (${advancedCount})` : ''}
        </Button>
        <Select
          ariaLabel="Sắp xếp danh sách"
          value={filters.sort ?? 'updated_desc'}
          options={SORT_OPTIONS}
          onChange={(value) => update('sort', value)}
        />
      </div>

      {advancedOpen && (
        <div id="advanced-filters" className="grid gap-3 rounded-lg border border-line bg-surface p-3 shadow-lift sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <span className={FIELD_LABEL_CLASS}>Trạng thái</span>
            <Select ariaLabel="Lọc theo trạng thái" value={filters.status} options={STATUS_OPTIONS} onChange={(value) => update('status', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Mức ưu tiên</span>
            <Select ariaLabel="Lọc theo mức ưu tiên" value={filters.priority} options={PRIORITY_OPTIONS} onChange={(value) => update('priority', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Phòng ban gửi</span>
            <Select ariaLabel="Lọc theo phòng ban gửi" value={filters.fromDepartment ?? 'all'} options={FROM_DEPARTMENT_OPTIONS} onChange={(value) => update('fromDepartment', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Phòng ban tiếp nhận</span>
            <Select ariaLabel="Lọc theo phòng ban xử lý" value={filters.department} options={TO_DEPARTMENT_OPTIONS} onChange={(value) => update('department', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Thời hạn SLA</span>
            <Select ariaLabel="Lọc theo thời hạn SLA" value={filters.due ?? 'all'} options={DUE_OPTIONS} onChange={(value) => update('due', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Tình trạng phân công</span>
            <Select ariaLabel="Lọc theo tình trạng phân công" value={filters.assignment ?? 'all'} options={ASSIGNMENT_OPTIONS} onChange={(value) => update('assignment', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Người xử lý</span>
            <Select ariaLabel="Lọc theo người xử lý" value={filters.assigneeName ?? ANY_ASSIGNEE_VALUE} options={ASSIGNEE_OPTIONS} onChange={(value) => update('assigneeName', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Tạo từ ngày</span>
            <DatePicker value={filters.createdFrom ?? ''} onChange={(value) => update('createdFrom', value)} />
          </div>
          <div>
            <span className={FIELD_LABEL_CLASS}>Tạo đến ngày</span>
            <DatePicker value={filters.createdTo ?? ''} min={filters.createdFrom || undefined} onChange={(value) => update('createdTo', value)} />
          </div>
        </div>
      )}

      {chips.length > 0 && (
        <ul aria-label="Bộ lọc đang áp dụng" className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <li key={chip.key}>
              <button
                type="button"
                onClick={() => onChange({ ...filters, ...chip.reset })}
                aria-label={`Bỏ bộ lọc ${chip.label}`}
                className="rounded-md border border-line-strong bg-canvas px-2 py-1 text-xs font-medium text-ink hover:border-accent-600"
              >
                {chip.label}
                <span aria-hidden="true" className="ml-1.5 text-ink-muted">Bỏ</span>
              </button>
            </li>
          ))}
          <li>
            <button
              type="button"
              onClick={handleReset}
              className="px-1 text-xs font-semibold text-accent-700 underline-offset-2 hover:underline"
            >
              Đặt lại bộ lọc
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}
