const SESSION_KEY = 'ticket.session.viewerName'

// Storage can be unavailable (private mode, blocked cookies); callers then fall back to an in-memory session
export function readStoredViewerName(): string | null {
  try {
    return window.sessionStorage.getItem(SESSION_KEY)
  } catch (error) {
    console.warn('Session storage is unavailable, the session will not survive a reload', error)
    return null
  }
}

export function writeStoredViewerName(name: string | null): void {
  try {
    if (name === null) window.sessionStorage.removeItem(SESSION_KEY)
    else window.sessionStorage.setItem(SESSION_KEY, name)
  } catch (error) {
    console.warn('Session storage is unavailable, the session will not survive a reload', error)
  }
}
