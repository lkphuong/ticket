import { useCallback, useId, useRef, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { COMPACT_SELECT_CLASS, SELECT_CLASS } from './controlStyles.ts'
import { useDismissOnOutsideClick } from './useDismissOnOutsideClick.ts'

export interface SelectOption<Value extends string> {
  value: Value
  label: string
  leading?: ReactNode
}

interface SelectProps<Value extends string> {
  id?: string
  value: Value
  options: SelectOption<Value>[]
  onChange: (value: Value) => void
  placeholder?: string
  ariaLabel?: string
  compact?: boolean
  invalid?: boolean
  describedBy?: string
  className?: string
}

export function Select<Value extends string>({
  id,
  value,
  options,
  onChange,
  placeholder = '',
  ariaLabel,
  compact = false,
  invalid = false,
  describedBy,
  className = '',
}: SelectProps<Value>) {
  const listboxId = useId()
  const containerRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const close = useCallback(() => setOpen(false), [])
  useDismissOnOutsideClick(containerRef, open, close)

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined

  function openList() {
    setActiveIndex(Math.max(selectedIndex, 0))
    setOpen(true)
  }

  function choose(index: number) {
    onChange(options[index].value)
    setOpen(false)
  }

  function moveActive(next: number) {
    setActiveIndex(Math.min(Math.max(next, 0), options.length - 1))
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const { key } = event
    if (key === 'Tab') {
      setOpen(false)
      return
    }
    if (key === 'Escape') {
      if (open) event.stopPropagation()
      setOpen(false)
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End', 'Enter', ' '].includes(key)) return
    event.preventDefault()
    if (!open) {
      openList()
      return
    }
    if (key === 'ArrowDown') moveActive(activeIndex + 1)
    else if (key === 'ArrowUp') moveActive(activeIndex - 1)
    else if (key === 'Home') moveActive(0)
    else if (key === 'End') moveActive(options.length - 1)
    else choose(activeIndex)
  }

  const optionId = (index: number) => `${listboxId}-option-${index}`

  return (
    <div ref={containerRef} className={compact ? 'relative inline-block' : 'relative'}>
      <button
        id={id}
        type="button"
        role="combobox"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        aria-activedescendant={open ? optionId(activeIndex) : undefined}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onClick={() => (open ? close() : openList())}
        onKeyDown={handleKeyDown}
        className={`${compact ? COMPACT_SELECT_CLASS : SELECT_CLASS} flex items-center text-left ${
          invalid ? 'border-brick-500' : ''
        } ${className}`}
      >
        <span className={`flex min-w-0 items-center gap-2 ${selected ? '' : 'text-ink-muted/70'}`}>
          {selected?.leading}
          <span className="truncate">{selected ? selected.label : placeholder}</span>
        </span>
      </button>
      {open && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className="absolute left-0 z-20 mt-1 max-h-64 min-w-full overflow-auto rounded-md border border-line-strong bg-surface py-1 shadow-lg"
        >
          {options.map((option, index) => {
            const isSelected = option.value === value
            const isActive = index === activeIndex
            return (
              <li
                key={option.value}
                id={optionId(index)}
                role="option"
                aria-selected={isSelected}
                onPointerEnter={() => setActiveIndex(index)}
                onPointerDown={(event) => event.preventDefault()}
                onClick={() => choose(index)}
                className={`flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-2 text-sm ${
                  isActive ? 'bg-accent-100 text-accent-800' : 'text-ink'
                } ${isSelected ? 'font-semibold' : ''}`}
              >
                {option.leading}
                <span>{option.label}</span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
