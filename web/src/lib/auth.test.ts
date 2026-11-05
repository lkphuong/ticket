import { describe, expect, it } from 'vitest'
import { MOCK_PASSWORD, authenticate, findViewerByName } from './auth.ts'

describe('authenticate', () => {
  it('should_return_viewer_when_credentials_match', () => {
    expect(authenticate('minhanh', MOCK_PASSWORD)?.name).toBe('Nguyễn Minh Anh')
  })

  it('should_ignore_case_and_spaces_when_matching_username', () => {
    expect(authenticate('  MinhAnh ', MOCK_PASSWORD)).not.toBeNull()
  })

  it('should_return_null_when_password_is_wrong', () => {
    expect(authenticate('minhanh', 'wrong')).toBeNull()
  })

  it('should_return_null_when_username_is_unknown', () => {
    expect(authenticate('nobody', MOCK_PASSWORD)).toBeNull()
  })

  it('should_not_expose_username_when_returning_viewer', () => {
    expect(authenticate('quocbao', MOCK_PASSWORD)).not.toHaveProperty('username')
  })
})

describe('findViewerByName', () => {
  it('should_return_null_when_name_is_unknown', () => {
    expect(findViewerByName('Không có')).toBeNull()
  })
})
