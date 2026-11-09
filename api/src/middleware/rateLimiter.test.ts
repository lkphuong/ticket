import { describe, expect, it } from 'bun:test'
import type { NextFunction, Request, Response } from 'express'
import { createRateLimiter } from './rateLimiter.ts'

const WINDOW_MS = 1000
const MAX_REQUESTS = 2

interface FakeResponse {
  statusCode: number
  headers: Record<string, string>
  body: unknown
}

function invoke(limiter: ReturnType<typeof createRateLimiter>, key: string | null): { passed: boolean; response: FakeResponse } {
  const response: FakeResponse = { statusCode: 200, headers: {}, body: undefined }
  const res = {
    setHeader: (name: string, value: string) => {
      response.headers[name] = value
    },
    status: (code: number) => {
      response.statusCode = code
      return res
    },
    json: (payload: unknown) => {
      response.body = payload
    },
  } as unknown as Response
  let passed = false
  const next: NextFunction = () => {
    passed = true
  }
  limiter({ headers: { 'x-test-key': key } } as unknown as Request, res, next)
  return { passed, response }
}

describe('createRateLimiter', () => {
  function build(clock: { time: number }) {
    return createRateLimiter({
      windowMs: WINDOW_MS,
      maxRequests: MAX_REQUESTS,
      resolveKey: (req) => (req.headers['x-test-key'] as string | null) ?? null,
      now: () => clock.time,
    })
  }

  it('should_allow_requests_when_under_the_limit', () => {
    const limiter = build({ time: 0 })
    expect(invoke(limiter, 'a').passed).toBe(true)
    expect(invoke(limiter, 'a').passed).toBe(true)
  })

  it('should_reject_with_retry_after_when_limit_is_exceeded', () => {
    const limiter = build({ time: 0 })
    invoke(limiter, 'a')
    invoke(limiter, 'a')
    const blocked = invoke(limiter, 'a')
    expect(blocked.passed).toBe(false)
    expect(blocked.response.statusCode).toBe(429)
    expect(blocked.response.headers['Retry-After']).toBe('1')
  })

  it('should_track_each_key_independently', () => {
    const limiter = build({ time: 0 })
    invoke(limiter, 'a')
    invoke(limiter, 'a')
    expect(invoke(limiter, 'b').passed).toBe(true)
  })

  it('should_allow_requests_again_when_the_window_has_elapsed', () => {
    const clock = { time: 0 }
    const limiter = build(clock)
    invoke(limiter, 'a')
    invoke(limiter, 'a')
    invoke(limiter, 'a')
    clock.time = WINDOW_MS
    expect(invoke(limiter, 'a').passed).toBe(true)
  })

  it('should_skip_limiting_when_the_request_has_no_key', () => {
    const limiter = build({ time: 0 })
    for (let attempt = 0; attempt < MAX_REQUESTS + 3; attempt += 1) {
      expect(invoke(limiter, null).passed).toBe(true)
    }
  })
})
