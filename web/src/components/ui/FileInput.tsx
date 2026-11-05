import type { ChangeEvent } from 'react'

interface FileInputProps {
  id: string
  selectedCount: number
  onChange: (event: ChangeEvent<HTMLInputElement>) => void
}

// Themed picker so the labels stay Vietnamese regardless of browser language
export function FileInput({ id, selectedCount, onChange }: FileInputProps) {
  return (
    <div className="flex items-center gap-3">
      <input id={id} type="file" multiple onChange={onChange} className="peer sr-only" />
      <label
        htmlFor={id}
        className="cursor-pointer rounded-md border border-line-strong bg-surface px-3 py-1.5 text-sm font-semibold text-ink hover:bg-canvas peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent-600"
      >
        Chọn tệp
      </label>
      <span className="text-sm text-ink-muted">{selectedCount > 0 ? `${selectedCount} tệp đã chọn` : 'Chưa chọn tệp'}</span>
    </div>
  )
}
