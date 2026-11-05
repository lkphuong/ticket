import { useCallback, useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  WEEKDAY_LABELS,
  addDays,
  addMonths,
  buildMonthGrid,
  formatDisplayDate,
  formatMonthTitle,
  parseIsoDate,
  toIsoDate,
} from '../../lib/calendar.ts'
import { SELECT_CLASS } from './controlStyles.ts'
import { useDismissOnOutsideClick } from './useDismissOnOutsideClick.ts'

const DAYS_PER_WEEK = 7

const KEY_STEP_IN_DAYS: Record<string, number> = {
  ArrowLeft: -1,
  ArrowRight: 1,
  ArrowUp: -DAYS_PER_WEEK,
  ArrowDown: DAYS_PER_WEEK,
}

interface DatePickerProps {
  id?: string
  value: string
  onChange: (value: string) => void
  min?: string
  placeholder?: string
  invalid?: boolean
  describedBy?: string
  className?: string
}

const NAV_BUTTON_CLASS =
  'rounded-md px-2 py-1 text-xs font-semibold text-ink-muted hover:bg-ash-200 hover:text-ink disabled:cursor-not-allowed disabled:opacity-40'

export function DatePicker({
  id,
  value,
  onChange,
  min,
  placeholder = 'dd/mm/yyyy',
  invalid = false,
  describedBy,
  className = '',
}: DatePickerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [focusedIso, setFocusedIso] = useState('')
  const [todayIso] = useState(() => toIsoDate(new Date()))
  const close = useCallback(() => setOpen(false), [])
  useDismissOnOutsideClick(containerRef, open, close)

  // Move DOM focus to the active day whenever the keyboard changes it
  useEffect(() => {
    if (!open) return
    gridRef.current?.querySelector<HTMLButtonElement>(`[data-iso="${focusedIso}"]`)?.focus()
  }, [open, focusedIso])

  function isDisabled(iso: string): boolean {
    return Boolean(min) && iso < (min as string)
  }

  function openCalendar() {
    const start = value || (min && todayIso < min ? min : todayIso)
    setFocusedIso(start)
    setOpen(true)
  }

  function closeAndRefocus() {
    setOpen(false)
    triggerRef.current?.focus()
  }

  function pick(iso: string) {
    if (isDisabled(iso)) return
    onChange(iso)
    closeAndRefocus()
  }

  function handleGridKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const { key } = event
    if (key === 'Escape') {
      event.stopPropagation()
      closeAndRefocus()
      return
    }
    const step = KEY_STEP_IN_DAYS[key]
    if (step !== undefined) setFocusedIso(addDays(focusedIso, step))
    else if (key === 'PageUp') setFocusedIso(addMonths(focusedIso, -1))
    else if (key === 'PageDown') setFocusedIso(addMonths(focusedIso, 1))
    else return
    event.preventDefault()
  }

  const shown = parseIsoDate(focusedIso || value || todayIso)
  const grid = buildMonthGrid(shown.getFullYear(), shown.getMonth())

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        ref={triggerRef}
        id={id}
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openCalendar())}
        onKeyDown={(event) => {
          if (event.key === 'Escape' && open) {
            event.stopPropagation()
            close()
          }
        }}
        className={`${SELECT_CLASS} text-left ${invalid ? 'border-brick-500' : ''} ${value ? '' : 'text-ink-muted/70'}`}
      >
        {value ? formatDisplayDate(value) : placeholder}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Chọn ngày"
          className="absolute left-0 z-20 mt-1 w-72 rounded-md border border-line-strong bg-surface p-3 shadow-lg"
        >
          <div className="mb-2 flex items-center justify-between">
            <button type="button" className={NAV_BUTTON_CLASS} onClick={() => setFocusedIso(addMonths(focusedIso, -1))}>
              Tháng trước
            </button>
            <p aria-live="polite" className="text-sm font-semibold text-ink">
              {formatMonthTitle(toIsoDate(shown))}
            </p>
            <button type="button" className={NAV_BUTTON_CLASS} onClick={() => setFocusedIso(addMonths(focusedIso, 1))}>
              Tháng sau
            </button>
          </div>
          <div ref={gridRef} role="grid" onKeyDown={handleGridKeyDown} className="grid grid-cols-7 gap-0.5">
            {WEEKDAY_LABELS.map((label) => (
              <span key={label} className="py-1 text-center text-xs font-semibold text-ink-muted">
                {label}
              </span>
            ))}
            {grid.map((cell) => {
              const isSelected = cell.iso === value
              const isToday = cell.iso === todayIso
              const disabled = isDisabled(cell.iso)
              let tone = cell.inMonth ? 'text-ink hover:bg-accent-100' : 'text-ink-muted/60 hover:bg-ash-200'
              if (isSelected) tone = 'bg-accent-600 font-semibold text-white hover:bg-accent-700'
              else if (isToday) tone = `${tone} font-semibold ring-1 ring-inset ring-accent-600`
              return (
                <button
                  key={cell.iso}
                  type="button"
                  data-iso={cell.iso}
                  tabIndex={cell.iso === focusedIso ? 0 : -1}
                  disabled={disabled}
                  aria-selected={isSelected}
                  aria-current={isToday ? 'date' : undefined}
                  aria-label={formatDisplayDate(cell.iso)}
                  onClick={() => pick(cell.iso)}
                  className={`rounded-md py-1.5 text-center text-sm disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent ${tone}`}
                >
                  {cell.day}
                </button>
              )
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-line pt-2">
            <button type="button" className={NAV_BUTTON_CLASS} disabled={isDisabled(todayIso)} onClick={() => pick(todayIso)}>
              Hôm nay
            </button>
            <button
              type="button"
              className={NAV_BUTTON_CLASS}
              disabled={!value}
              onClick={() => {
                onChange('')
                closeAndRefocus()
              }}
            >
              Xóa ngày
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
