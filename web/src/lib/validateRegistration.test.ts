import { describe, expect, it } from 'bun:test'
import {
  isValidEmailFormat,
  normalizeEmail,
  validateRegistrationFields,
  validateRegistrationForm,
  type RegistrationFormState,
} from './validateRegistration.ts'

describe('User Registration Validation', () => {
  const baseValidForm: RegistrationFormState = {
    username: 'nv001',
    name: 'Nguyễn Văn Một',
    department: 'Kinh doanh',
    role: 'staff',
    email: 'vanmot@gmail.com',
    password: 'password123',
    confirmPassword: 'password123',
  }

  it('should_accept_any_standard_email_domain_when_format_is_valid', () => {
    const domains = ['gmail.com', 'outlook.com', 'yahoo.com', 'company.vn', 'sub.example.org']
    for (const domain of domains) {
      expect(validateRegistrationForm({ ...baseValidForm, email: `user@${domain}` })).toBeNull()
    }
  })

  it('should_reject_email_when_format_is_not_standard', () => {
    const malformed = ['invalid-email', 'user@', '@domain.com', 'user@domain', 'us er@domain.com']
    for (const email of malformed) {
      expect(isValidEmailFormat(email)).toBe(false)
      expect(validateRegistrationForm({ ...baseValidForm, email })).toContain('định dạng')
    }
  })

  it('should_report_empty_email_separately_when_email_is_blank', () => {
    expect(validateRegistrationForm({ ...baseValidForm, email: '   ' })).toContain('không được để trống')
  })

  it('should_lowercase_and_trim_email_when_normalizing', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
    expect(isValidEmailFormat('  User@Example.COM ')).toBe(true)
  })

  it('should_reject_manager_role_when_department_already_has_a_manager', () => {
    const occupied = { 'Kinh doanh': 'Trần Quốc Bảo' }
    const headForm: RegistrationFormState = { ...baseValidForm, role: 'head' }

    const error = validateRegistrationForm(headForm, occupied)
    expect(error).toContain('đã có quản lý')
    expect(error).toContain('Trần Quốc Bảo')
    expect(validateRegistrationForm({ ...baseValidForm, role: 'staff' }, occupied)).toBeNull()
  })

  it('should_reject_short_username_or_missing_name', () => {
    expect(validateRegistrationForm({ ...baseValidForm, username: 'a' })).toContain('2 ký tự')
    expect(validateRegistrationForm({ ...baseValidForm, name: '  ' })).toContain('không được để trống')
  })

  it('should_reject_mismatched_or_short_passwords', () => {
    expect(
      validateRegistrationForm({ ...baseValidForm, password: '123', confirmPassword: '123' }),
    ).toContain('6 ký tự')
    expect(
      validateRegistrationForm({ ...baseValidForm, password: 'password123', confirmPassword: 'different123' }),
    ).toContain('không khớp')
  })

  it('should_return_one_message_per_invalid_field_when_several_fields_fail', () => {
    const errors = validateRegistrationFields({
      ...baseValidForm,
      username: '',
      email: 'nope',
      confirmPassword: 'other',
    })
    expect(Object.keys(errors).sort()).toEqual(['confirmPassword', 'email', 'username'])
  })

  it('should_return_no_field_errors_when_form_is_valid', () => {
    expect(validateRegistrationFields(baseValidForm)).toEqual({})
  })
})
