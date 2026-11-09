import type { NextFunction, Request, RequestHandler, Response } from 'express'

const HSTS_MAX_AGE_SECONDS = 15552000

// Conservative response headers for a JSON API that never serves HTML
export function createSecurityHeaders(isProduction: boolean): RequestHandler {
  return (_req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('X-Frame-Options', 'DENY')
    res.setHeader('Referrer-Policy', 'no-referrer')
    res.removeHeader('X-Powered-By')
    if (isProduction) {
      res.setHeader('Strict-Transport-Security', `max-age=${HSTS_MAX_AGE_SECONDS}; includeSubDomains`)
    }
    next()
  }
}
