import type { Db } from 'mongodb'
import { ensureMongoIndexes } from './indexes.ts'

// Ensures every collection index exists and reports which collections were processed
export async function runMigrations(db: Db): Promise<string[]> {
  return ensureMongoIndexes(db)
}
