import { Icon } from './Icon.tsx'
import { Select } from './Select.tsx'

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const

interface PaginationProps {
  page: number
  limit: number
  total: number
  totalPages: number
  onPageChange: (page: number) => void
  onLimitChange: (limit: number) => void
}

const PAGE_BUTTON_CLASS =
  'inline-flex h-8 items-center gap-1 rounded-md border border-line-strong bg-surface px-2.5 text-xs font-semibold text-ink transition-colors hover:bg-canvas focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-600/40 disabled:cursor-not-allowed disabled:opacity-50'

export function Pagination({ page, limit, total, totalPages, onPageChange, onLimitChange }: PaginationProps) {
  const first = total === 0 ? 0 : (page - 1) * limit + 1
  const last = Math.min(page * limit, total)

  return (
    <nav
      aria-label="Phân trang"
      className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t border-line bg-canvas px-4 py-2.5 text-xs text-ink-muted"
    >
      <p className="tabular-nums">
        Hiển thị <span className="font-semibold text-ink">{first}-{last}</span> trên{' '}
        <span className="font-semibold text-ink">{total}</span>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <span>Số dòng</span>
          <Select
            compact
            ariaLabel="Số dòng mỗi trang"
            value={String(limit)}
            options={PAGE_SIZE_OPTIONS.map((size) => ({ value: String(size), label: String(size) }))}
            onChange={(value) => onLimitChange(Number(value))}
          />
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={PAGE_BUTTON_CLASS} disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
            <Icon name="chevronLeft" className="size-3.5" />
            Trước
          </button>
          <span className="min-w-20 text-center tabular-nums">
            Trang <span className="font-semibold text-ink">{page}</span> / {totalPages}
          </span>
          <button
            type="button"
            className={PAGE_BUTTON_CLASS}
            disabled={page >= totalPages}
            onClick={() => onPageChange(page + 1)}
          >
            Sau
            <Icon name="chevronRight" className="size-3.5" />
          </button>
        </div>
      </div>
    </nav>
  )
}
