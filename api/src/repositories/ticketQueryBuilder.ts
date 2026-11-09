import type { Document, Filter } from 'mongodb'
import { ACTIVE_STATUSES, TICKET_PRIORITIES } from '@vtdesk/domain'
import type { TicketSort } from '@vtdesk/domain'
import type { TicketDocument } from '../db/schema.ts'
import type { TicketQuery } from './interfaces.ts'

const ISO_DATE_LENGTH = 10
// Sorts after every real ISO date string so tickets without a due date come last
const MISSING_DUE_DATE_SORT_KEY = '￿'

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// Mirrors canViewTicket: staff see tickets they raised or handle, heads add their department, admins see everything
function buildVisibilityClause(query: TicketQuery): Filter<TicketDocument> | null {
  const { viewer } = query
  if (viewer.isExecutive || viewer.isAdmin || viewer.role === 'admin') return null
  const branches: Filter<TicketDocument>[] = [{ requesterName: viewer.name }, { assigneeName: viewer.name }]
  if (viewer.isDepartmentHead) {
    branches.push({ fromDepartment: viewer.department }, { toDepartment: viewer.department })
  }
  return { $or: branches }
}

function buildScopeClause(query: TicketQuery): Filter<TicketDocument> | null {
  const { scope } = query.filters
  const { viewer } = query
  if (scope === 'sent') return { requesterName: viewer.name }
  if (scope === 'received') return { toDepartment: viewer.department }
  if (scope === 'assigned') return { assigneeName: viewer.name }
  return null
}

function buildTextClause(rawQuery: string): Filter<TicketDocument> | null {
  const needle = rawQuery.trim().normalize('NFC')
  if (!needle) return null
  const pattern = { $regex: escapeRegex(needle), $options: 'i' }
  return {
    $or: [
      { _id: pattern },
      { code: pattern },
      { title: pattern },
      { requesterName: pattern },
      { description: pattern },
      { assigneeName: pattern },
      { fromDepartment: pattern },
      { toDepartment: pattern },
    ],
  }
}

function buildCreatedRangeClauses(from: string, to: string): Filter<TicketDocument>[] {
  const clauses: Filter<TicketDocument>[] = []
  if (from) clauses.push({ createdAt: { $gte: from } })
  // The upper bound is inclusive of the whole calendar day
  if (to) clauses.push({ createdAt: { $lte: `${to}￿` } })
  return clauses
}

// Mirrors matchesDueFilter, which only treats active tickets with a due date as overdue or due today
function buildDueClause(due: string, now: Date): Filter<TicketDocument> | null {
  const today = now.toISOString().slice(0, ISO_DATE_LENGTH)
  const activeStatuses = { status: { $in: [...ACTIVE_STATUSES] } }
  if (due === 'overdue') return { ...activeStatuses, dueDate: { $lt: today } }
  if (due === 'due_today') return { ...activeStatuses, dueDate: today }
  if (due === 'on_track') return { ...activeStatuses, $or: [{ dueDate: null }, { dueDate: { $gte: today } }] }
  return null
}

function buildAssignmentClause(assignment: string): Filter<TicketDocument> | null {
  if (assignment === 'unassigned') return { assigneeName: { $in: [null, ''] } }
  if (assignment === 'assigned') return { assigneeName: { $nin: [null, ''] } }
  return null
}

// Translates a visibility-scoped ticket query into one MongoDB filter that can use the ticket indexes
export function buildTicketFilter(query: TicketQuery): Filter<TicketDocument> {
  const { filters } = query
  const clauses: Array<Filter<TicketDocument> | null> = [
    buildVisibilityClause(query),
    buildScopeClause(query),
    buildTextClause(filters.query),
    filters.status !== 'all' ? { status: filters.status } : null,
    filters.priority !== 'all' ? { priority: filters.priority } : null,
    filters.department !== 'all' ? { toDepartment: filters.department } : null,
    filters.fromDepartment && filters.fromDepartment !== 'all' ? { fromDepartment: filters.fromDepartment } : null,
    ...buildCreatedRangeClauses(filters.createdFrom ?? '', filters.createdTo ?? ''),
    buildDueClause(filters.due ?? 'all', query.now),
    buildAssignmentClause(filters.assignment ?? 'all'),
    filters.assigneeName ? { assigneeName: filters.assigneeName } : null,
  ]
  const present = clauses.filter((clause): clause is Filter<TicketDocument> => clause !== null)
  return present.length > 0 ? { $and: present } : {}
}

// Builds the aggregation stages that order tickets exactly like the domain sort, with the id as a stable tiebreaker
export function buildTicketSortStages(sort: TicketSort = 'updated_desc'): Document[] {
  if (sort === 'due_asc') {
    return [
      { $addFields: { dueSortKey: { $ifNull: ['$dueDate', MISSING_DUE_DATE_SORT_KEY] } } },
      { $sort: { dueSortKey: 1, updatedAt: -1, _id: 1 } },
    ]
  }
  if (sort === 'priority_desc') {
    return [
      // Domain priorities are listed lowest first, so the position plus one is the score used by the domain sort
      { $addFields: { priorityScore: { $add: [{ $indexOfArray: [[...TICKET_PRIORITIES], '$priority'] }, 1] } } },
      { $sort: { priorityScore: -1, _id: 1 } },
    ]
  }
  if (sort === 'created_desc') return [{ $sort: { createdAt: -1, _id: 1 } }]
  return [{ $sort: { updatedAt: -1, _id: 1 } }]
}
