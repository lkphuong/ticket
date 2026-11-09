export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 100

export interface PageRequest {
  readonly page: number
  readonly limit: number
}

export interface Page<T> {
  readonly items: T[]
  readonly total: number
  readonly page: number
  readonly limit: number
  readonly totalPages: number
}

function parsePositiveInteger(raw: unknown, fallback: number): number {
  const parsed = Number.parseInt(String(raw ?? ''), 10)
  return Number.isFinite(parsed) && parsed >= 1 ? parsed : fallback
}

// Reads page and limit from a query string, falling back to safe defaults and capping the page size
export function parsePageRequest(query: Record<string, unknown>): PageRequest {
  return {
    page: parsePositiveInteger(query.page, 1),
    limit: Math.min(parsePositiveInteger(query.limit, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
  }
}

// Slices a list into one page; a page past the end resolves to the last page so callers never land on an empty page
export function paginate<T>(items: readonly T[], request: PageRequest): Page<T> {
  const total = items.length
  const totalPages = Math.max(1, Math.ceil(total / request.limit))
  const page = Math.min(request.page, totalPages)
  const offset = (page - 1) * request.limit
  return { items: items.slice(offset, offset + request.limit), total, page, limit: request.limit, totalPages }
}

// Lowercases and strips Vietnamese diacritics so "nguyen" finds "Nguyễn"
export function normalizeSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .toLowerCase()
    .trim()
}
