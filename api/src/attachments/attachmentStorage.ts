import { randomUUID } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

export const ATTACHMENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

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

// Keeps each file as <id> next to an <id>.json sidecar so the original name and type survive without a database
export class DiskAttachmentStorage implements IAttachmentStorage {
  private readonly directory: string

  constructor(directory: string) {
    this.directory = resolve(directory)
  }

  async save(input: SaveAttachmentInput): Promise<StoredAttachment> {
    const stored: StoredAttachment = {
      id: randomUUID(),
      name: input.name,
      mimeType: input.mimeType,
      sizeBytes: input.content.length,
    }
    await mkdir(this.directory, { recursive: true })
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

  private contentPath(id: string): string {
    return join(this.directory, id)
  }

  private metadataPath(id: string): string {
    return join(this.directory, `${id}.json`)
  }
}
