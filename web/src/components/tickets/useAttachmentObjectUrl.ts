import { useEffect, useState } from 'react'
import { apiClient } from '../../lib/apiClient.ts'

export interface AttachmentObjectUrl {
  url: string | null
  failed: boolean
}

// Loads the attachment bytes into an object URL and revokes it on unmount, so media never leaks memory
export function useAttachmentObjectUrl(id: string, enabled = true): AttachmentObjectUrl {
  const [state, setState] = useState<AttachmentObjectUrl>({ url: null, failed: false })

  useEffect(() => {
    if (!enabled) return
    let objectUrl: string | null = null
    let cancelled = false
    apiClient.attachments
      .fetchContent(id)
      .then((blob) => {
        if (cancelled) return
        objectUrl = URL.createObjectURL(blob)
        setState({ url: objectUrl, failed: false })
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, failed: true })
      })
    return () => {
      cancelled = true
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [id, enabled])

  return state
}
