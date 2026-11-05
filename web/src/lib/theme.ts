export type Theme = 'light' | 'dark'

// Must match the key read by the inline script in index.html
export const THEME_STORAGE_KEY = 'vtdesk-theme'

export function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark'
}

export function toggleTheme(theme: Theme): Theme {
  return theme === 'dark' ? 'light' : 'dark'
}

// A saved choice wins over the operating system preference
export function resolveInitialTheme(saved: string | null, prefersDark: boolean): Theme {
  if (isTheme(saved)) return saved
  return prefersDark ? 'dark' : 'light'
}

export function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme
}

export function readStoredTheme(): string | null {
  try {
    return window.localStorage.getItem(THEME_STORAGE_KEY)
  } catch (error) {
    console.warn('Local storage is unavailable, the theme choice will not be remembered', error)
    return null
  }
}

export function writeStoredTheme(theme: Theme): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch (error) {
    console.warn('Local storage is unavailable, the theme choice will not be remembered', error)
  }
}
