import type { Db } from 'mongodb'
import { COLLECTION_NAMES } from './schema.ts'

// Clears all documents from application collections while preserving indexes and collection configuration
export async function resetDatabase(db: Db): Promise<void> {
  for (const name of Object.values(COLLECTION_NAMES)) {
    await db.collection(name).deleteMany({})
  }
}
