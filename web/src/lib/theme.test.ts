import { describe, expect, it } from 'vitest'
import { resolveInitialTheme, toggleTheme } from './theme.ts'

describe('resolveInitialTheme', () => {
  it('should_use_saved_theme_when_saved_value_is_valid', () => {
    expect(resolveInitialTheme('light', true)).toBe('light')
    expect(resolveInitialTheme('dark', false)).toBe('dark')
  })

  it('should_follow_system_preference_when_nothing_is_saved', () => {
    expect(resolveInitialTheme(null, true)).toBe('dark')
    expect(resolveInitialTheme(null, false)).toBe('light')
  })

  it('should_ignore_saved_value_when_it_is_not_a_theme', () => {
    expect(resolveInitialTheme('sepia', true)).toBe('dark')
  })
})

describe('toggleTheme', () => {
  it('should_switch_between_light_and_dark', () => {
    expect(toggleTheme('light')).toBe('dark')
    expect(toggleTheme('dark')).toBe('light')
  })
})
