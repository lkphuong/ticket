import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import type { SqlExecutor } from './migrator.ts'
import type { AnyDrizzleDb } from '../repositories/postgresTicketStore.ts'

export interface DatabaseConnection {
  readonly db: AnyDrizzleDb
  readonly executor: SqlExecutor
  readonly close: () => Promise<void>
}

// Opens a pooled PostgreSQL connection exposing both the Drizzle client and a raw SQL executor for migrations
export function createDatabaseConnection(databaseUrl: string): DatabaseConnection {
  const client = postgres(databaseUrl, { max: 10 })
  return {
    db: drizzle(client),
    executor: { exec: (sql: string) => client.unsafe(sql) },
    close: () => client.end(),
  }
}
