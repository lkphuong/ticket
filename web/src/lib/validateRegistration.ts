// Pure validation rules for user self-registration input

export interface RegistrationFormState {
  readonly username: string
  readonly name: string
  readonly department: string
  readonly role: 'staff' | 'head'
  readonly email: string
  readonly password: string
  readonly confirmPassword: string
}

export type RegistrationField = 'username' | 'name' | 'department' | 'email' | 'password' | 'confirmPassword'

export type RegistrationFieldErrors = Partial<Record<RegistrationField, string>>

const MIN_USERNAME_LENGTH = 2
const MIN_PASSWORD_LENGTH = 6
const STANDARD_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// Order in which fields are reported when a caller needs just the first problem
const FIELD_ORDER: readonly RegistrationField[] = ['username', 'name', 'department', 'email', 'password', 'confirmPassword']

// Trims and lowercases so the same address is always stored and compared one way
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isValidEmailFormat(email: string): boolean {
  return STANDARD_EMAIL_PATTERN.test(normalizeEmail(email))
}

function validateEmailField(email: string): string | undefined {
  if (!email.trim()) return 'Địa chỉ email không được để trống.'
  if (!isValidEmailFormat(email)) return 'Địa chỉ email không đúng định dạng.'
  return undefined
}

function validateDepartmentField(
  form: RegistrationFormState,
  occupiedDepartmentHeads?: Record<string, string>,
): string | undefined {
  if (!form.department) return 'Vui lòng chọn phòng ban.'
  const managerName = occupiedDepartmentHeads?.[form.department]
  // A department can only ever have one head
  if (form.role === 'head' && managerName) {
    return `Phòng ban "${form.department}" đã có quản lý (${managerName}). Mỗi phòng ban chỉ được có 1 quản lý.`
  }
  return undefined
}

// Collects one message per invalid field so a form can show each next to its input
export function validateRegistrationFields(
  form: RegistrationFormState,
  occupiedDepartmentHeads?: Record<string, string>,
): RegistrationFieldErrors {
  const candidates: RegistrationFieldErrors = {
    username:
      form.username.trim().length < MIN_USERNAME_LENGTH
        ? `Tên tài khoản (mã nhân viên) phải có ít nhất ${MIN_USERNAME_LENGTH} ký tự.`
        : undefined,
    name: form.name.trim() ? undefined : 'Họ và tên không được để trống.',
    department: validateDepartmentField(form, occupiedDepartmentHeads),
    email: validateEmailField(form.email),
    password:
      form.password.length < MIN_PASSWORD_LENGTH ? `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.` : undefined,
    confirmPassword: form.password !== form.confirmPassword ? 'Mật khẩu xác nhận không khớp.' : undefined,
  }

  const errors: RegistrationFieldErrors = {}
  for (const field of FIELD_ORDER) {
    const message = candidates[field]
    if (message) errors[field] = message
  }
  return errors
}

// Returns the first actionable error message or null when the form is valid
export function validateRegistrationForm(
  form: RegistrationFormState,
  occupiedDepartmentHeads?: Record<string, string>,
): string | null {
  const errors = validateRegistrationFields(form, occupiedDepartmentHeads)
  const firstField = FIELD_ORDER.find((field) => errors[field])
  return firstField ? (errors[firstField] ?? null) : null
}
