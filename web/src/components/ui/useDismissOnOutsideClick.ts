import { useEffect } from 'react'
import type { RefObject } from 'react'

// Closes a popup when a pointer press lands outside its container
export function useDismissOnOutsideClick(containerRef: RefObject<HTMLElement | null>, active: boolean, onDismiss: () => void) {
  useEffect(() => {
    if (!active) return
    function handlePointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) onDismiss()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [containerRef, active, onDismiss])
}
