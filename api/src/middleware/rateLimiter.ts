import type { NextFunction, Request, RequestHandler, Response } from 'express'

export interface RateLimiterOptions {
  readonly windowMs: number
  readonly maxRequests: number
  // Returns the bucket identity for a request, or null when the request carries no identity to limit
  readonly resolveKey: (req: Request) => string | null
  readonly now?: () => number
}

interface Bucket {
  count: number
  windowStartedAt: number
}

const MILLISECONDS_PER_SECOND = 1000
const RETRY_AFTER_HEADER = 'Retry-After'

// Fixed-window counter per key; expired buckets are swept lazily so memory stays bounded by active keys
export function createRateLimiter(options: RateLimiterOptions): RequestHandler {
  const buckets = new Map<string, Bucket>()
  const now = options.now ?? Date.now

  function sweepExpired(currentTime: number): void {
    for (const [key, bucket] of buckets) {
      if (currentTime - bucket.windowStartedAt >= options.windowMs) buckets.delete(key)
    }
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    const key = options.resolveKey(req)
    if (key === null) {
      next()
      return
    }

    const currentTime = now()
    sweepExpired(currentTime)

    const bucket = buckets.get(key) ?? { count: 0, windowStartedAt: currentTime }
    bucket.count += 1
    buckets.set(key, bucket)

    if (bucket.count > options.maxRequests) {
      const retryAfterSeconds = Math.ceil((bucket.windowStartedAt + options.windowMs - currentTime) / MILLISECONDS_PER_SECOND)
      res.setHeader(RETRY_AFTER_HEADER, String(Math.max(1, retryAfterSeconds)))
      res.status(429).json({
        error: 'TooManyRequests',
        message: 'Quá nhiều yêu cầu. Vui lòng thử lại sau.',
        retryAfterSeconds: Math.max(1, retryAfterSeconds),
      })
      return
    }

    next()
  }
}

// Bucket identity from the client address
export function resolveClientAddressKey(scope: string): (req: Request) => string {
  return (req) => `${scope}:ip:${req.ip ?? 'unknown'}`
}

// Bucket identity from a lowercase account identifier found in the JSON body, so one account cannot be hammered from many addresses
export function resolveAccountIdentifierKey(scope: string, fieldNames: readonly string[]): (req: Request) => string | null {
  return (req) => {
    const body = (req.body ?? {}) as Record<string, unknown>
    for (const fieldName of fieldNames) {
      const value = body[fieldName]
      if (typeof value === 'string' && value.trim().length > 0) {
        return `${scope}:account:${value.trim().toLowerCase()}`
      }
    }
    return null
  }
}
