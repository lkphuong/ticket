import { describe, expect, it } from 'vitest'
import { MAX_AVATAR_BYTES, validateAvatarFile } from './avatarFile.ts'

describe('validateAvatarFile', () => {
  it('should_accept_file_when_it_is_a_small_supported_image', () => {
    expect(validateAvatarFile({ type: 'image/png', size: 1024 })).toBeNull()
  })

  it('should_reject_file_when_type_is_not_a_supported_image', () => {
    expect(validateAvatarFile({ type: 'application/pdf', size: 1024 })).toContain('PNG')
  })

  it('should_reject_file_when_it_exceeds_the_size_limit', () => {
    expect(validateAvatarFile({ type: 'image/jpeg', size: MAX_AVATAR_BYTES + 1 })).toContain('2 MB')
  })

  it('should_accept_file_when_size_equals_the_limit', () => {
    expect(validateAvatarFile({ type: 'image/webp', size: MAX_AVATAR_BYTES })).toBeNull()
  })
})
