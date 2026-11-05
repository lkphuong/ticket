import { loadEnvironmentConfig, requireDatabaseUrl } from '../config/environment.ts'
import { createDatabaseConnection } from './connection.ts'
import { runMigrations } from './migrator.ts'

// Applies pending SQL migrations to the configured database
async function main(): Promise<void> {
  const connection = createDatabaseConnection(requireDatabaseUrl(loadEnvironmentConfig()))
  try {
    const applied = await runMigrations(connection.executor)
    console.log(applied.length > 0 ? `Applied migrations: ${applied.join(', ')}` : 'Database is already up to date.')
  } finally {
    await connection.close()
  }
}

main().catch((error: unknown) => {
  console.error(`Migration failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
