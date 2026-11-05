import { describe, expect, it } from 'vitest'
import { deriveDepartmentCodePrefix, deterministicUuid, formatTicketCode, formatTicketPeriod, parseTicketCode } from './ticketCode.ts'

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/

describe('ticket code', () => {
  it('should_format_period_as_year_and_month_when_date_is_given', () => {
    expect(formatTicketPeriod(new Date('2026-11-05T12:00:00Z'))).toBe('2611')
    expect(formatTicketPeriod(new Date('2027-01-31T23:00:00Z'))).toBe('2701')
  })

  it('should_pad_sequence_to_three_digits_when_formatting', () => {
    expect(formatTicketCode('CNTT', '2611', 1)).toBe('TCK-CNTT-2611-001')
    expect(formatTicketCode('KD', '2611', 1000)).toBe('TCK-KD-2611-1000')
  })

  it('should_round_trip_when_parsing_a_formatted_code', () => {
    expect(parseTicketCode('TCK-CNTT-2611-042')).toEqual({ prefix: 'CNTT', period: '2611', sequence: 42 })
  })

  it('should_return_null_when_code_is_malformed', () => {
    expect(parseTicketCode('TCK-1010')).toBeNull()
  })

  it('should_derive_initials_without_diacritics_when_prefix_is_missing', () => {
    expect(deriveDepartmentCodePrefix('Công nghệ thông tin')).toBe('CNTT')
    expect(deriveDepartmentCodePrefix('Đào tạo')).toBe('DT')
  })
})

describe('deterministicUuid', () => {
  it('should_return_same_well_formed_uuid_when_seed_repeats', () => {
    expect(deterministicUuid('ticket:a')).toMatch(UUID_PATTERN)
    expect(deterministicUuid('ticket:a')).toBe(deterministicUuid('ticket:a'))
  })

  it('should_return_different_uuid_when_seed_differs', () => {
    expect(deterministicUuid('ticket:a')).not.toBe(deterministicUuid('ticket:b'))
  })
})
