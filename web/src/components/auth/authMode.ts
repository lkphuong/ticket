export type AuthMode = 'login' | 'register' | 'verify'

// Only these two values may be linked to from outside the page
export function readInitialAuthMode(search: string): AuthMode {
  const mode = new URLSearchParams(search).get('mode')
  return mode === 'verify' || mode === 'register' ? mode : 'login'
}
