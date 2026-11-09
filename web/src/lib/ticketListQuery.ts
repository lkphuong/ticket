import { DEFAULT_TICKET_FILTERS } from './ticketFilters.ts'
import type { TicketFilters } from './ticketFilters.ts'

export type TicketListParams = Record<string, string | number | undefined>

// Filter fields the list API accepts as query parameters, besides paging
const FILTER_KEYS = [
  'scope',
  'query',
  'status',
  'priority',
  'department',
  'fromDepartment',
  'createdFrom',
  'createdTo',
  'due',
  'assignment',
  'assigneeName',
  'sort',
] as const satisfies readonly (keyof TicketFilters)[]

// Sends only filters that differ from their defaults so URLs stay short and the server applies its own defaults
export function toTicketFilterParams(filters: TicketFilters): TicketListParams {
  const params: TicketListParams = {}
  for (const key of FILTER_KEYS) {
    const value = filters[key]
    const isDefault = value === DEFAULT_TICKET_FILTERS[key]
    const text = typeof value === 'string' ? value.trim() : value
    if (!isDefault && text !== undefined && text !== '') params[key] = text
  }
  return params
}

export function toTicketListParams(filters: TicketFilters, page: number, limit: number): TicketListParams {
  return { ...toTicketFilterParams(filters), page, limit }
}
