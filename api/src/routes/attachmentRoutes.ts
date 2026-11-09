import express from 'express'
import type { NextFunction, Request, RequestHandler, Response } from 'express'
import type { IAttachmentStorage } from '../attachments/attachmentStorage.ts'

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024
const FILE_NAME_HEADER = 'x-file-name'
const FALLBACK_MIME_TYPE = 'application/octet-stream'
// Only formats browsers render passively are served inline; anything else is forced to download
const INLINE_MIME_TYPES = new Set([
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

function readFileName(req: Request): string | null {
  const header = req.headers[FILE_NAME_HEADER]
  if (typeof header !== 'string' || header.length === 0) return null
  try {
    const decoded = decodeURIComponent(header).trim()
    return decoded.length > 0 ? decoded.slice(0, 255) : null
  } catch {
    return null
  }
}

function readMimeType(req: Request): string {
  const declared = (req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase()
  return declared || FALLBACK_MIME_TYPE
}

// RFC 5987 encoding so non-ASCII names such as Vietnamese file names survive the header
function encodeDispositionName(name: string): string {
  return encodeURIComponent(name).replace(/['()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`)
}

function rejectOversizedUpload(err: Error & { type?: string }, _req: Request, res: Response, next: NextFunction): void {
  if (err.type === 'entity.too.large') {
    res.status(413).json({ error: 'PayloadTooLarge', message: 'Tệp vượt quá 10 MB.' })
    return
  }
  next(err)
}

// Upload and download of attachment content; tickets only reference files by id
export function createAttachmentRouter(storage: IAttachmentStorage, authMiddleware: RequestHandler): express.Router {
  const router = express.Router()

  router.post(
    '/',
    authMiddleware,
    express.raw({ type: () => true, limit: MAX_UPLOAD_BYTES }),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const name = readFileName(req)
        if (!name) {
          res.status(400).json({ error: 'BadRequest', message: 'Thiếu tên tệp trong header X-File-Name.' })
          return
        }
        if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
          res.status(400).json({ error: 'BadRequest', message: 'Tệp tải lên không có nội dung.' })
          return
        }
        const stored = await storage.save({ name, mimeType: readMimeType(req), content: req.body })
        res.status(201).json({
          attachment: {
            id: stored.id,
            name: stored.name,
            mimeType: stored.mimeType,
            sizeKb: Math.max(1, Math.round(stored.sizeBytes / 1024)),
          },
        })
      } catch (error) {
        next(error)
      }
    },
    rejectOversizedUpload,
  )

  router.get('/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const found = await storage.find(req.params.id)
      if (!found) {
        res.status(404).json({ error: 'NotFound', message: 'Tệp đính kèm không tồn tại.' })
        return
      }
      const inline = req.query.download !== '1' && INLINE_MIME_TYPES.has(found.mimeType)
      res.setHeader('Content-Type', inline ? found.mimeType : FALLBACK_MIME_TYPE)
      res.setHeader('X-Content-Type-Options', 'nosniff')
      res.setHeader('Content-Disposition', `${inline ? 'inline' : 'attachment'}; filename*=UTF-8''${encodeDispositionName(found.name)}`)
      res.sendFile(found.filePath, { dotfiles: 'allow' })
    } catch (error) {
      next(error)
    }
  })

  return router
}
