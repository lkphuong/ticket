import { describe, expect, it } from 'bun:test'
import { assertSeedAllowed, parseSeedOptions } from './seedOptions.ts'

describe('parseSeedOptions', () => {
  it('should_default_to_non_destructive_when_no_flags_are_given', () => {
    expect(parseSeedOptions([])).toEqual({ reset: false, assumeYes: false })
  })

  it('should_enable_reset_and_yes_when_flags_are_given', () => {
    expect(parseSeedOptions(['--reset', '--yes'])).toEqual({ reset: true, assumeYes: true })
  })

  it('should_throw_when_flag_is_unknown', () => {
    expect(() => parseSeedOptions(['--rest'])).toThrow('--rest')
  })
})

describe('assertSeedAllowed', () => {
  it('should_throw_when_environment_is_production', () => {
    expect(() => assertSeedAllowed('production')).toThrow('production')
  })

  it('should_allow_seeding_when_environment_is_development_or_staging', () => {
    expect(() => assertSeedAllowed('development')).not.toThrow()
    expect(() => assertSeedAllowed('staging')).not.toThrow()
  })
})
