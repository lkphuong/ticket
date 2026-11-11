const BYTES_PER_MB = 1024 * 1024
const MAX_AVATAR_MB = 2

export const AVATAR_MIME_TYPES: readonly string[] = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']
export const AVATAR_ACCEPT = AVATAR_MIME_TYPES.join(',')
export const MAX_AVATAR_BYTES = MAX_AVATAR_MB * BYTES_PER_MB

// Returns a Vietnamese message when the file cannot be a profile picture, or null when it is acceptable
export function validateAvatarFile(file: Pick<File, 'type' | 'size'>): string | null {
  if (!AVATAR_MIME_TYPES.includes(file.type)) return 'Ảnh đại diện phải là tệp PNG, JPEG, WebP hoặc GIF.'
  if (file.size > MAX_AVATAR_BYTES) return `Ảnh đại diện không được vượt quá ${MAX_AVATAR_MB} MB.`
  return null
}
