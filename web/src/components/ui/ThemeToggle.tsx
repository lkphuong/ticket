import { useState } from 'react'
import { applyTheme, isTheme, toggleTheme, writeStoredTheme } from '../../lib/theme.ts'
import type { Theme } from '../../lib/theme.ts'
import { Button } from './Button.tsx'
import { Icon } from './Icon.tsx'

// The inline script in index.html has already set the attribute before React mounts
function readAppliedTheme(): Theme {
  const applied = document.documentElement.dataset.theme
  return isTheme(applied) ? applied : 'light'
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(readAppliedTheme)
  const next = toggleTheme(theme)

  function handleToggle() {
    applyTheme(next)
    writeStoredTheme(next)
    setTheme(next)
  }

  return (
    <Button
      variant="secondary"
      className="gap-1.5 px-2.5 py-1 text-xs"
      aria-label={next === 'dark' ? 'Chuyển sang giao diện tối' : 'Chuyển sang giao diện sáng'}
      onClick={handleToggle}
    >
      <Icon name={next === 'dark' ? 'moon' : 'sun'} />
      {next === 'dark' ? 'Giao diện tối' : 'Giao diện sáng'}
    </Button>
  )
}
