// Lets the signed-in member upload, replace or remove their profile picture

import { useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { apiClient } from '../../lib/apiClient.ts'
import { AVATAR_ACCEPT, validateAvatarFile } from '../../lib/avatarFile.ts'
import { useToast } from '../../lib/toastContext.ts'
import { useAuth } from '../../state/useAuth.ts'
import { Avatar } from '../ui/Avatar.tsx'
import { Button } from '../ui/Button.tsx'

export function AvatarSettings() {
  const { viewer, updateAvatar } = useAuth()
  const { notify } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!viewer) return null

  async function saveAvatar(action: () => Promise<string | null>, successMessage: string) {
    setError('')
    setIsSaving(true)
    try {
      await updateAvatar(await action())
      notify(successMessage, 'success')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Không thể cập nhật ảnh đại diện.')
    } finally {
      setIsSaving(false)
    }
  }

  function handleFileChosen(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    // Reset so choosing the same file again still fires a change event
    event.target.value = ''
    if (!file) return
    const problem = validateAvatarFile(file)
    if (problem) {
      setError(problem)
      return
    }
    void saveAvatar(async () => (await apiClient.attachments.upload(file)).id ?? null, 'Đã cập nhật ảnh đại diện.')
  }

  return (
    <section aria-labelledby="profile-avatar-heading" className="flex flex-col gap-2">
      <h3 id="profile-avatar-heading" className="text-xs font-bold tracking-wider text-ink uppercase">
        Ảnh đại diện
      </h3>
      <div className="flex items-center gap-4">
        <Avatar department={viewer.department} sizeClass="size-16" attachmentId={viewer.avatarAttachmentId} />
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={isSaving} onClick={() => fileInputRef.current?.click()}>
            {viewer.avatarAttachmentId ? 'Đổi ảnh' : 'Tải ảnh lên'}
          </Button>
          {viewer.avatarAttachmentId && (
            <Button
              variant="danger"
              className="px-3 py-1.5 text-xs"
              disabled={isSaving}
              onClick={() => void saveAvatar(async () => null, 'Đã gỡ ảnh đại diện.')}
            >
              Gỡ ảnh
            </Button>
          )}
        </div>
        <input ref={fileInputRef} type="file" accept={AVATAR_ACCEPT} className="hidden" onChange={handleFileChosen} />
      </div>
      <p className="text-xs text-ink-muted">PNG, JPEG, WebP hoặc GIF, tối đa 2 MB.</p>
      {error && (
        <p role="alert" className="text-xs text-brick-700">
          {error}
        </p>
      )}
    </section>
  )
}
