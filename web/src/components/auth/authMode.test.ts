import { describe, expect, it } from 'bun:test'
import { readInitialAuthMode } from './authMode.ts'

describe('readInitialAuthMode', () => {
  it('should_open_verify_or_register_when_mode_param_names_them', () => {
    expect(readInitialAuthMode('?mode=verify')).toBe('verify')
    expect(readInitialAuthMode('?mode=register')).toBe('register')
  })

  it('should_open_login_when_mode_is_missing_or_unknown', () => {
    expect(readInitialAuthMode('')).toBe('login')
    expect(readInitialAuthMode('?mode=admin')).toBe('login')
  })

  it('should_ignore_activation_link_params_when_they_are_present', () => {
    expect(readInitialAuthMode('?verifyToken=123456')).toBe('login')
    expect(readInitialAuthMode('?token=abc')).toBe('login')
  })
})
