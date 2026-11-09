import type { Db, MongoClient } from 'mongodb'
import { createMongoConnection } from './mongoConnection.ts'
import type { MongoDatabaseConnection } from './mongoConnection.ts'

export interface DatabaseConnection {
  readonly client: MongoClient
  readonly db: Db
  readonly close: () => Promise<void>
  readonly ping: () => Promise<boolean>
}

// Opens a pooled MongoDB database connection exposing the database handle and lifecycle controls
export function createDatabaseConnection(uriOrUrl: string, databaseName = 'ticket'): DatabaseConnection {
  const mongoConn = createMongoConnection(uriOrUrl, databaseName)
  return {
    client: mongoConn.client,
    db: mongoConn.db,
    close: mongoConn.close,
    ping: mongoConn.ping,
  }
}

export { createMongoConnection }
export type { MongoDatabaseConnection }
