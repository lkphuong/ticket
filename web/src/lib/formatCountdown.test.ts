import { describe, expect, it } from 'bun:test'
import { formatCountdown } from './formatCountdown.ts'

describe('formatCountdown', () => {
  it('should_pad_minutes_and_seconds_when_formatting', () => {
    expect(formatCountdown(600)).toBe('10:00')
    expect(formatCountdown(65)).toBe('01:05')
  })

  it('should_clamp_to_zero_when_value_is_negative', () => {
    expect(formatCountdown(-5)).toBe('00:00')
  })
})
