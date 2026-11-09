import { afterAll, beforeAll, describe, expect, it } from 'bun:test'
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { ATTACHMENT_ID_PATTERN, DiskAttachmentStorage } from './attachmentStorage.ts'

const UPLOAD_TIME = new Date('2026-03-09T08:00:00Z')
const LEGACY_ID = '0f6fe3f9-ef72-4f7f-ac87-cb9feaf75fbf'
const CONTENT = Buffer.from('hello')

describe('DiskAttachmentStorage', () => {
  let directory: string
  let storage: DiskAttachmentStorage

  beforeAll(async () => {
    directory = await mkdtemp(join(tmpdir(), 'vtdesk-storage-'))
    storage = new DiskAttachmentStorage(directory, () => UPLOAD_TIME)
  })

  afterAll(async () => {
    await rm(directory, { recursive: true, force: true })
  })

  it('should_store_file_under_year_and_month_folder_when_saved', async () => {
    const stored = await storage.save({ name: 'a.txt', mimeType: 'text/plain', content: CONTENT })
    expect(stored.id).toStartWith('202603_')
    const files = await readdir(join(directory, '2026', '03'))
    expect(files).toHaveLength(2)
  })

  it('should_find_saved_file_when_looked_up_by_id', async () => {
    const stored = await storage.save({ name: 'b.txt', mimeType: 'text/plain', content: CONTENT })
    const found = await storage.find(stored.id)
    expect(found?.name).toBe('b.txt')
    expect(found?.filePath).toContain(join('2026', '03'))
  })

  it('should_find_legacy_file_when_id_has_no_month_prefix', async () => {
    await writeFile(join(directory, LEGACY_ID), CONTENT)
    await writeFile(join(directory, `${LEGACY_ID}.json`), JSON.stringify({ id: LEGACY_ID, name: 'old.txt', mimeType: 'text/plain', sizeBytes: 5 }))
    const found = await storage.find(LEGACY_ID)
    expect(found?.name).toBe('old.txt')
  })

  it('should_return_null_when_id_is_unknown', async () => {
    expect(await storage.find('202603_00000000-0000-4000-8000-000000000000')).toBeNull()
  })

  it('should_reject_id_when_month_or_path_is_invalid', () => {
    expect(ATTACHMENT_ID_PATTERN.test(`202613_${LEGACY_ID}`)).toBe(false)
    expect(ATTACHMENT_ID_PATTERN.test(`../${LEGACY_ID}`)).toBe(false)
    expect(ATTACHMENT_ID_PATTERN.test(`202603_${LEGACY_ID}`)).toBe(true)
  })
})
