export const WEEKDAY_LABELS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN']

const DAYS_PER_WEEK = 7
const GRID_WEEKS = 6
const MONTHS_PER_YEAR = 12

export interface CalendarDay {
  iso: string
  day: number
  inMonth: boolean
}

function pad(value: number): string {
  return String(value).padStart(2, '0')
}

// Local calendar date, not UTC, so the picked day never shifts across timezones
export function toIsoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day)
}

export function addDays(iso: string, amount: number): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() + amount)
  return toIsoDate(date)
}

// Moving by months keeps the day number but clamps to the last day of shorter months
export function addMonths(iso: string, amount: number): string {
  const date = parseIsoDate(iso)
  const targetIndex = date.getFullYear() * MONTHS_PER_YEAR + date.getMonth() + amount
  const year = Math.floor(targetIndex / MONTHS_PER_YEAR)
  const month = targetIndex % MONTHS_PER_YEAR
  const lastDay = new Date(year, month + 1, 0).getDate()
  return toIsoDate(new Date(year, month, Math.min(date.getDate(), lastDay)))
}

// Always six Monday-first weeks so the popup keeps the same height from month to month
export function buildMonthGrid(year: number, month: number): CalendarDay[] {
  const firstOfMonth = new Date(year, month, 1)
  const leadingDays = (firstOfMonth.getDay() + DAYS_PER_WEEK - 1) % DAYS_PER_WEEK
  const cells: CalendarDay[] = []
  for (let index = 0; index < DAYS_PER_WEEK * GRID_WEEKS; index += 1) {
    const date = new Date(year, month, 1 - leadingDays + index)
    cells.push({ iso: toIsoDate(date), day: date.getDate(), inMonth: date.getMonth() === month })
  }
  return cells
}

export function formatMonthTitle(iso: string): string {
  const date = parseIsoDate(iso)
  return `Tháng ${date.getMonth() + 1}, ${date.getFullYear()}`
}

export function formatDisplayDate(iso: string): string {
  const date = parseIsoDate(iso)
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`
}
