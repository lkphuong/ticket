const TICKET_CODE_LABEL = 'TCK'
const TICKET_CODE_PATTERN = /^TCK-([A-Z0-9]+)-(\d{4})-(\d+)$/
const MIN_SEQUENCE_DIGITS = 3

// Short uppercase prefixes stored with each department and printed inside ticket codes
export const DEPARTMENT_CODE_PREFIXES: Record<string, string> = {
  'Công nghệ thông tin': 'CNTT',
  'Nhân sự': 'NS',
  'Kế toán': 'KT',
  Marketing: 'MKT',
  'Kinh doanh': 'KD',
  'Vận hành': 'VH',
  'Pháp chế': 'PC',
  'Hành chính': 'HC',
}

export interface ParsedTicketCode {
  prefix: string
  period: string
  sequence: number
}

// Year and month as YYMM, e.g. 2026-11 becomes 2611
export function formatTicketPeriod(date: Date): string {
  const year = String(date.getUTCFullYear()).slice(-2)
  const month = String(date.getUTCMonth() + 1).padStart(2, '0')
  return `${year}${month}`
}

// Builds a code such as TCK-CNTT-2611-001; the sequence grows past three digits when needed
export function formatTicketCode(prefix: string, period: string, sequence: number): string {
  return `${TICKET_CODE_LABEL}-${prefix}-${period}-${String(sequence).padStart(MIN_SEQUENCE_DIGITS, '0')}`
}

export function parseTicketCode(code: string): ParsedTicketCode | null {
  const match = TICKET_CODE_PATTERN.exec(code)
  if (!match) return null
  return { prefix: match[1], period: match[2], sequence: Number(match[3]) }
}

// Derives initials without diacritics from a department name, e.g. "Công nghệ thông tin" becomes CNTT
export function deriveDepartmentCodePrefix(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .split(/\s+/)
    .filter((word) => word.length > 0)
    .map((word) => word[0].toUpperCase())
    .join('')
    .replace(/[^A-Z0-9]/g, '')
}

const UUID_MIX_ROUNDS = 4

// Stable uuid derived from a seed string so sample data keeps the same ids across seed runs
export function deterministicUuid(seed: string): string {
  const hex: string[] = []
  for (let round = 0; round < UUID_MIX_ROUNDS; round++) {
    let hash = 0x811c9dc5 ^ (round * 0x9e3779b1)
    for (let i = 0; i < seed.length; i++) {
      hash = Math.imul(hash ^ seed.charCodeAt(i), 0x01000193)
    }
    hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b)
    hex.push((hash >>> 0).toString(16).padStart(8, '0'))
  }
  const digits = hex.join('')
  // Version nibble 4 and variant nibble 8 keep the value a well formed uuid
  return `${digits.slice(0, 8)}-${digits.slice(8, 12)}-4${digits.slice(13, 16)}-8${digits.slice(17, 20)}-${digits.slice(20, 32)}`
}
