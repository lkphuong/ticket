import { describe, expect, it } from 'vitest'
import { DEFAULT_TICKET_FILTERS } from './ticketFilters.ts'
import { toTicketFilterParams, toTicketListParams } from './ticketListQuery.ts'

describe('ticket list query', () => {
  it('should_send_only_paging_when_filters_are_default', () => {
    expect(toTicketListParams(DEFAULT_TICKET_FILTERS, 1, 20)).toEqual({ page: 1, limit: 20 })
  })

  it('should_include_changed_filters_and_trim_the_search_text', () => {
    const params = toTicketFilterParams({ ...DEFAULT_TICKET_FILTERS, query: '  mạng  ', status: 'open', priority: 'urgent' })

    expect(params).toEqual({ query: 'mạng', status: 'open', priority: 'urgent' })
  })

  it('should_drop_blank_search_text_when_only_whitespace_is_typed', () => {
    expect(toTicketFilterParams({ ...DEFAULT_TICKET_FILTERS, query: '   ' })).toEqual({})
  })
})
