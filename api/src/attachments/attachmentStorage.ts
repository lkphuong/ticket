import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const UUID_SOURCE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
const PERIOD_SEPARATOR = '_'
// New ids carry their upload month (YYYYMM_uuid); bare uuids are files stored before month folders existed
export const ATTACHMENT_ID_PATTERN = new RegExp(`^(?:(\\d{4})(0[1-9]|1[0-2])${PERIOD_SEPARATOR})?${UUID_SOURCE}$`, 'i')

export interface StoredAttachment {
  readonly id: string
  readonly name: string
  readonly mimeType: string
  readonly sizeBytes: number
}

export interface AttachmentLocation extends StoredAttachment {
  readonly filePath: string
}

export interface SaveAttachmentInput {
  readonly name: string
  readonly mimeType: string
  readonly content: Buffer
}

export interface IAttachmentStorage {
  save(input: SaveAttachmentInput): Promise<StoredAttachment>
  find(id: string): Promise<AttachmentLocation | null>
}

// Keeps each file as <uuid> next to a <uuid>.json sidecar inside a yyyy/mm folder so the original name and type survive without a database
export class DiskAttachmentStorage implements IAttachmentStorage {
  private readonly directory: string

  constructor(directory: string, private readonly now: () => Date = () => new Date()) {
    this.directory = resolve(directory)
  }

  async save(input: SaveAttachmentInput): Promise<StoredAttachment> {
    const uploadedAt = this.now()
    const year = String(uploadedAt.getUTCFullYear())
    const month = String(uploadedAt.getUTCMonth() + 1).padStart(2, '0')
    const stored: StoredAttachment = {
      id: `${year}${month}${PERIOD_SEPARATOR}${randomUUID()}`,
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.content.length,
    }
    await mkdir(join(this.directory, year, month), { recursive: true })
    await writeFile(this.contentPath(stored.id), input.content)
    await writeFile(this.metadataPath(stored.id), JSON.stringify(stored))
    return stored
  }

  async find(id: string): Promise<AttachmentLocation | null> {
    // The pattern check also keeps path separators out of the lookup
    if (!ATTACHMENT_ID_PATTERN.test(id)) return null
    let raw: string
    try {
      raw = await readFile(this.metadataPath(id), 'utf8')
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null
      throw new Error(`Unable to read attachment metadata for ${id}`, { cause: error })
    }
    return { ...(JSON.parse(raw) as StoredAttachment), filePath: this.contentPath(id) }
  }

  // Resolves the folder holding an id, falling back to the flat root for ids that predate month folders
  private folderFor(id: string): string {
    const match = ATTACHMENT_ID_PATTERN.exec(id)
    const year = match?.[1]
    const month = match?.[2]
    return year && month ? join(this.directory, year, month) : this.directory
  }

  private fileNameFor(id: string): string {
    return id.includes(PERIOD_SEPARATOR) ? id.slice(id.indexOf(PERIOD_SEPARATOR) + 1) : id
  }

  private contentPath(id: string): string {
    return join(this.folderFor(id), this.fileNameFor(id))
  }

  private metadataPath(id: string): string {
    return `${this.contentPath(id)}.json`
  }
}
