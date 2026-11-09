import { loadEnvironmentConfig, requireMongoUri } from '../config/environment.ts'
import { MongoTicketStore } from '../repositories/mongoTicketStore.ts'
import { confirmByTyping } from './confirmPrompt.ts'
import { createDatabaseConnection } from './connection.ts'
import { runMigrations } from './migrator.ts'
import { resetDatabase } from './resetDatabase.ts'
import { seedDatabase } from './seed.ts'
import { assertSeedAllowed, parseSeedOptions } from './seedOptions.ts'

const RESET_CONFIRMATION_WORD = 'RESET'

// Applies indexes then seeds demo data into MongoDB; existing documents are kept unless --reset is confirmed
async function main(): Promise<void> {
  const options = parseSeedOptions(process.argv.slice(2))
  const config = loadEnvironmentConfig()
  assertSeedAllowed(config.nodeEnv)

  const connection = createDatabaseConnection(requireMongoUri(config), config.mongodbDbName)
  try {
    await runMigrations(connection.db)

    if (options.reset) {
      if (!options.assumeYes && !(await confirmByTyping('This deletes ALL data in the target database.', RESET_CONFIRMATION_WORD))) {
        console.log('Reset cancelled, no data was changed.')
        return
      }
      await resetDatabase(connection.db)
      console.log('All application collections were cleared.')
    }

    await seedDatabase(new MongoTicketStore(connection.db))
    console.log('Seed completed.')
  } finally {
    await connection.close()
  }
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
