import { useState } from 'react'
import type { FormEvent } from 'react'
import type { Department } from '../../domain/ticket.ts'
import { ApiError, apiClient } from '../../lib/apiClient.ts'
import { useToast } from '../../lib/toastContext.ts'
import { normalizeEmail, validateRegistrationFields } from '../../lib/validateRegistration.ts'
import type { RegistrationField, RegistrationFieldErrors, RegistrationFormState } from '../../lib/validateRegistration.ts'
import { Button } from '../ui/Button.tsx'
import { DepartmentTile } from '../ui/DepartmentTile.tsx'
import { FormField } from '../ui/FormField.tsx'
import { Select } from '../ui/Select.tsx'
import { AuthTextField } from './AuthTextField.tsx'
import { RoleChoice } from './RoleChoice.tsx'
import { useRegistrationDirectory } from './useRegistrationDirectory.ts'

const REGISTER_FALLBACK_MESSAGE = 'Không thể hoàn tất đăng ký lúc này. Vui lòng kiểm tra lại thông tin.'

const EMPTY_FORM: RegistrationFormState = {
  username: '',
  name: '',
  department: '',
  role: 'staff',
  email: '',
  password: '',
  confirmPassword: '',
}

export interface RegisteredAccount {
  readonly username: string
  readonly email: string
}

interface RegisterFormProps {
  readonly onRegistered: (account: RegisteredAccount) => void
  readonly onOpenLogin: () => void
}

// Keeps only the server field errors that belong to a visible input
function pickFieldErrors(serverErrors: Record<string, string> | undefined): RegistrationFieldErrors {
  const knownFields: readonly RegistrationField[] = ['username', 'name', 'department', 'email', 'password']
  const picked: RegistrationFieldErrors = {}
  for (const field of knownFields) {
    if (serverErrors?.[field]) picked[field] = serverErrors[field]
  }
  return picked
}

export function RegisterForm({ onRegistered, onOpenLogin }: RegisterFormProps) {
  const { notify } = useToast()
  const { departments, occupiedHeads } = useRegistrationDirectory()
  const [form, setForm] = useState<RegistrationFormState>(EMPTY_FORM)
  const [fieldErrors, setFieldErrors] = useState<RegistrationFieldErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  const occupiedHeadName = form.department ? occupiedHeads[form.department] : undefined

  // Editing a field clears its own message so stale errors never linger
  function updateField<K extends keyof RegistrationFormState>(field: K, value: RegistrationFormState[K]) {
    setForm((current) => ({ ...current, [field]: value }))
    setFieldErrors((current) => ({ ...current, [field]: undefined }))
  }

  function handleDepartmentChange(department: string) {
    const isOccupied = Boolean(occupiedHeads[department])
    setForm((current) => ({ ...current, department, role: isOccupied ? 'staff' : current.role }))
    setFieldErrors((current) => ({ ...current, department: undefined }))
  }

  async function submitRegistration() {
    const email = normalizeEmail(form.email)
    const username = form.username.trim().toLowerCase()
    setIsSubmitting(true)
    try {
      await apiClient.auth.register({
        username,
        name: form.name.trim(),
        department: form.department,
        role: form.role,
        email,
        password: form.password,
      })
      notify(`Đăng ký thành công. Mã OTP đã được gửi tới ${email}.`, 'success')
      onRegistered({ username, email })
    } catch (error: unknown) {
      if (error instanceof ApiError) setFieldErrors(pickFieldErrors(error.errors))
      notify(error instanceof ApiError ? error.message : REGISTER_FALLBACK_MESSAGE, 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const errors = validateRegistrationFields(form, occupiedHeads)
    setFieldErrors(errors)
    if (Object.keys(errors).length > 0) return
    void submitRegistration()
  }

  const departmentOptions = departments.map((department) => ({
    value: department,
    label: occupiedHeads[department] ? `${department} (đã có quản lý: ${occupiedHeads[department]})` : department,
    leading: <DepartmentTile department={department as Department} sizeClass="size-5 rounded" />,
  }))

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <h2 className="text-lg font-bold text-ink">Đăng ký tài khoản</h2>

      <AuthTextField
        id="reg-username"
        label="Tên tài khoản (mã nhân viên)"
        autoComplete="username"
        placeholder="Ví dụ: NV0123"
        value={form.username}
        onChange={(value) => updateField('username', value)}
        error={fieldErrors.username}
      />
      <AuthTextField
        id="reg-name"
        label="Họ và tên"
        autoComplete="name"
        placeholder="Ví dụ: Nguyễn Văn A"
        value={form.name}
        onChange={(value) => updateField('name', value)}
        error={fieldErrors.name}
      />

      <FormField id="reg-department" label="Phòng ban" error={fieldErrors.department}>
        <Select
          id="reg-department"
          value={form.department}
          options={departmentOptions}
          onChange={handleDepartmentChange}
          placeholder="Chọn phòng ban trực thuộc"
          className="w-full bg-surface shadow-xs hover:border-accent-600 focus:ring-accent-600/30"
        />
      </FormField>

      <RoleChoice
        value={form.role}
        onChange={(role) => updateField('role', role)}
        isHeadUnavailable={Boolean(occupiedHeadName)}
        headUnavailableNote={`Phòng ban này đã có quản lý (${occupiedHeadName}). Bạn chỉ có thể đăng ký vai trò Nhân viên.`}
      />

      <AuthTextField
        id="reg-email"
        label="Địa chỉ email"
        type="email"
        autoComplete="email"
        placeholder="ten@congty.vn"
        hint="Mã xác thực sẽ được gửi tới địa chỉ này."
        value={form.email}
        onChange={(value) => updateField('email', value)}
        error={fieldErrors.email}
      />
      <AuthTextField
        id="reg-password"
        label="Mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="Tối thiểu 6 ký tự"
        value={form.password}
        onChange={(value) => updateField('password', value)}
        error={fieldErrors.password}
      />
      <AuthTextField
        id="reg-confirm-password"
        label="Xác nhận mật khẩu"
        type="password"
        autoComplete="new-password"
        placeholder="Nhập lại mật khẩu"
        value={form.confirmPassword}
        onChange={(value) => updateField('confirmPassword', value)}
        error={fieldErrors.confirmPassword}
      />

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? 'Đang tạo tài khoản...' : 'Đăng ký tài khoản'}
      </Button>

      <div className="border-t border-line pt-3 text-center text-sm">
        <button type="button" onClick={onOpenLogin} className="font-medium text-accent-700 hover:underline">
          Đã có tài khoản? Đăng nhập
        </button>
      </div>
    </form>
  )
}
