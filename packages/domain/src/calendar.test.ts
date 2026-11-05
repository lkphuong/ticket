import { describe, expect, it } from 'vitest'
import { addDays, addMonths, buildMonthGrid, formatDisplayDate, formatMonthTitle, toIsoDate } from './calendar.ts'

describe('calendar', () => {
  it('should_start_grid_on_monday_when_month_starts_midweek', () => {
    // 1 Nov 2026 is a Sunday, so the grid opens with the Monday of the week before
    const grid = buildMonthGrid(2026, 10)
    expect(grid).toHaveLength(42)
    expect(grid[0].iso).toBe('2026-10-26')
    expect(grid[0].inMonth).toBe(false)
    expect(grid[6].iso).toBe('2026-11-01')
    expect(grid[6].inMonth).toBe(true)
  })

  it('should_flag_trailing_days_as_outside_month_when_month_ends', () => {
    const grid = buildMonthGrid(2026, 10)
    expect(grid[41].iso).toBe('2026-12-06')
    expect(grid[41].inMonth).toBe(false)
  })

  it('should_cross_month_boundary_when_adding_days', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01')
    expect(addDays('2026-11-01', -1)).toBe('2026-10-31')
  })

  it('should_clamp_to_last_day_when_target_month_is_shorter', () => {
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
  })

  it('should_format_local_date_without_timezone_shift', () => {
    expect(toIsoDate(new Date(2026, 5, 1))).toBe('2026-06-01')
    expect(formatDisplayDate('2026-06-01')).toBe('01/06/2026')
    expect(formatMonthTitle('2026-06-01')).toBe('Tháng 6, 2026')
  })
})
