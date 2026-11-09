import { describe, expect, it } from 'vitest'
import { getPreviewKind, MAX_ATTACHMENT_BYTES, selectAttachmentFiles } from './attachmentFiles.ts'

function makeFile(name: string, size: number): File {
  const file = new File(['x'], name)
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('selectAttachmentFiles', () => {
  it('should_accept_file_when_size_equals_limit', () => {
    const result = selectAttachmentFiles([makeFile('a.pdf', MAX_ATTACHMENT_BYTES)])
    expect(result.accepted).toHaveLength(1)
    expect(result.oversizedNames).toEqual([])
  })

  it('should_reject_file_when_size_exceeds_limit', () => {
    const result = selectAttachmentFiles([makeFile('big.zip', MAX_ATTACHMENT_BYTES + 1), makeFile('ok.png', 2048)])
    expect(result.accepted.map((picked) => picked.attachment.name)).toEqual(['ok.png'])
    expect(result.oversizedNames).toEqual(['big.zip'])
  })

  it('should_report_at_least_one_kb_when_file_is_tiny', () => {
    const result = selectAttachmentFiles([makeFile('tiny.txt', 10)])
    expect(result.accepted[0].attachment.sizeKb).toBe(1)
  })
})

describe('getPreviewKind', () => {
  it('should_return_image_when_type_is_a_supported_image', () => {
    expect(getPreviewKind('image/png')).toBe('image')
  })

  it('should_return_video_when_type_is_a_supported_video', () => {
    expect(getPreviewKind('video/mp4')).toBe('video')
  })

  it.each(['image/svg+xml', 'application/pdf', 'text/html', undefined])('should_return_null_when_type_is_%s', (type) => {
    expect(getPreviewKind(type)).toBeNull()
  })
})
