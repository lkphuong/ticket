import { useState } from 'react'
import { applyTheme, isTheme, toggleTheme, writeStoredTheme } from '../../lib/theme.ts'
import type { Theme } from '../../lib/theme.ts'
import { Icon } from './Icon.tsx'

// The inline script in index.html has already set the attribute before React mounts
function readAppliedTheme(): Theme {
  const applied = document.documentElement.dataset.theme
  return isTheme(applied) ? applied : 'light'
}

// Floats above every page; sits below modals (z-50) and toasts (z-60) and clears device safe areas
export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readAppliedTheme)
  const next = toggleTheme(theme)
  const label = next === 'dark' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'

  function handleToggle() {
    applyTheme(next)
    writeStoredTheme(next)
    setTheme(next)
  }

  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={handleToggle}
      style={{
        right: 'max(1rem, env(safe-area-inset-right))',
        bottom: 'max(1rem, env(safe-area-inset-bottom))',
      }}
      className="fixed z-40 inline-flex size-11 items-center justify-center rounded-full border border-line-strong bg-surface text-ink shadow-lift transition-colors hover:bg-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-600 print:hidden"
    >
      <Icon name={next === 'dark' ? 'moon' : 'sun'} className="size-5" />
    </button>
  )
}
