import type { SqlExecutor } from './migrator.ts'

// Child tables are cleared by CASCADE from their parents, but listing every table keeps the intent explicit
const RESETTABLE_TABLES = [
  'device_tokens',
  'audit_logs',
  'notifications',
  'default_slas',
  'request_templates',
  'ticket_assignment_history',
  'ticket_status_history',
  'comment_attachments',
  'ticket_comments',
  'ticket_attachments',
  'tickets',
  'members',
  'departments',
] as const

// Removes every row from application tables while keeping the schema and migration history
export async function resetDatabase(executor: SqlExecutor): Promise<void> {
  const tableList = RESETTABLE_TABLES.map((table) => `"${table}"`).join(', ')
  await executor.exec(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE;`)
}
