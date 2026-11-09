import { Icon } from './Icon.tsx'
import { IconButton } from './IconButton.tsx'

interface SearchFieldProps {
  value: string
  onChange: (value: string) => void
  placeholder: string
  ariaLabel: string
}

export function SearchField({ value, onChange, placeholder, ariaLabel }: SearchFieldProps) {
  return (
    <div className="relative min-w-52 flex-1">
      <Icon name="search" className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-ink-muted" />
      <input
        type="search"
        aria-label={ariaLabel}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-line-strong bg-surface py-1.5 pr-9 pl-9 text-sm text-ink placeholder:text-ink-muted/70 focus:border-accent-600 focus:outline-none focus:ring-2 focus:ring-accent-600/25 [&::-webkit-search-cancel-button]:hidden"
      />
      {value !== '' && (
        <IconButton
          icon="x"
          label="Xóa từ khóa tìm kiếm"
          onClick={() => onChange('')}
          className="absolute top-1/2 right-1 size-7 -translate-y-1/2"
        />
      )}
    </div>
  )
}
