import { loadEnvironmentConfig, requireMongoUri } from '../config/environment.ts'
import { createDatabaseConnection } from './connection.ts'
import { runMigrations } from './migrator.ts'

// Ensures MongoDB collections and performance indexes on configured database
async function main(): Promise<void> {
  const config = loadEnvironmentConfig()
  const connection = createDatabaseConnection(requireMongoUri(config), config.mongodbDbName)
  try {
    const applied = await runMigrations(connection.db)
    console.log(applied.length > 0 ? `Ensured MongoDB indexes: ${applied.join(', ')}` : 'MongoDB schema is already up to date.')
  } finally {
    await connection.close()
  }
}

main().catch((error: unknown) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
