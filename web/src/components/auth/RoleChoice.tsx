interface RoleOption {
  readonly value: 'staff' | 'head'
  readonly label: string
  readonly description: string
}

const ROLE_OPTIONS: readonly RoleOption[] = [
  { value: 'staff', label: 'Nhân viên', description: 'Tạo và xử lý yêu cầu' },
  { value: 'head', label: 'Quản lý', description: 'Mỗi phòng có một quản lý' },
]

interface RoleChoiceProps {
  readonly value: 'staff' | 'head'
  readonly onChange: (role: 'staff' | 'head') => void
  readonly isHeadUnavailable: boolean
  readonly headUnavailableNote?: string
}

export function RoleChoice({ value, onChange, isHeadUnavailable, headUnavailableNote }: RoleChoiceProps) {
  return (
    <fieldset className="flex flex-col gap-1.5">
      <legend className="mb-1.5 text-sm font-medium text-ink">Vai trò</legend>
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
        {ROLE_OPTIONS.map((option) => {
          const isDisabled = option.value === 'head' && isHeadUnavailable
          const isSelected = value === option.value
          return (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-2 rounded-md border p-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-600 ${
                isSelected ? 'border-accent-600 bg-accent-100' : 'border-line-strong bg-surface hover:border-ink-muted'
              } ${isDisabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              <input
                type="radio"
                name="registration-role"
                value={option.value}
                checked={isSelected}
                disabled={isDisabled}
                onChange={() => onChange(option.value)}
                className="mt-0.5 accent-accent-600"
              />
              <span className="flex flex-col">
                <span className="text-sm font-semibold text-ink">{option.label}</span>
                <span className="text-xs text-ink-muted">{option.description}</span>
              </span>
            </label>
          )
        })}
      </div>
      {isHeadUnavailable && headUnavailableNote && <p className="text-sm text-ochre-800">{headUnavailableNote}</p>}
    </fieldset>
  )
}
