import { MongoClient, MongoNetworkError, MongoServerSelectionError } from 'mongodb'
import type { Db } from 'mongodb'

export interface MongoDatabaseConnection {
  readonly client: MongoClient
  readonly db: Db
  readonly close: () => Promise<void>
  readonly ping: () => Promise<boolean>
}

// Establishes a pooled MongoClient connection configured for enterprise resilience
export function createMongoConnection(uri: string, databaseName = 'ticket'): MongoDatabaseConnection {
  if (!uri || typeof uri !== 'string') {
    throw new Error('Valid MongoDB connection URI must be provided.')
  }

  const client = new MongoClient(uri, {
    maxPoolSize: 25,
    minPoolSize: 5,
    connectTimeoutMS: 10000,
    serverSelectionTimeoutMS: 10000,
  })

  // Select database explicitly or inherit from URI path when configured
  const db = client.db(databaseName)

  return {
    client,
    db,
    close: async () => {
      await client.close()
    },
    ping: async () => {
      try {
        const pingResult = await db.command({ ping: 1 })
        return pingResult.ok === 1
      } catch (error: unknown) {
        // Only connectivity failures mean "unreachable"; any other failure is unexpected and must surface
        if (error instanceof MongoNetworkError || error instanceof MongoServerSelectionError) return false
        throw error
      }
    },
  }
}
