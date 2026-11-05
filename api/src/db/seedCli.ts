import { createInterface } from 'node:readline/promises'
import { loadEnvironmentConfig, requireDatabaseUrl } from '../config/environment.ts'
import { PostgresTicketStore } from '../repositories/postgresTicketStore.ts'
import { createDatabaseConnection } from './connection.ts'
import { runMigrations } from './migrator.ts'
import { resetDatabase } from './resetDatabase.ts'
import { seedDatabase } from './seed.ts'
import { assertSeedAllowed, parseSeedOptions } from './seedOptions.ts'

const RESET_CONFIRMATION_WORD = 'RESET'

// Asks the operator to type a confirmation word before any destructive reset
async function confirmReset(): Promise<boolean> {
  const prompt = createInterface({ input: process.stdin, output: process.stdout })
  const answer = await prompt.question(`This deletes ALL data in the target database. Type ${RESET_CONFIRMATION_WORD} to continue: `)
  prompt.close()
  return answer.trim() === RESET_CONFIRMATION_WORD
}

// Applies migrations then seeds demo data; existing rows are kept unless --reset is confirmed
async function main(): Promise<void> {
  const options = parseSeedOptions(process.argv.slice(2))
  const config = loadEnvironmentConfig()
  assertSeedAllowed(config.nodeEnv)

  const connection = createDatabaseConnection(requireDatabaseUrl(config))
  try {
    await runMigrations(connection.executor)

    if (options.reset) {
      if (!options.assumeYes && !(await confirmReset())) {
        console.log('Reset cancelled, no data was changed.')
        return
      }
      await resetDatabase(connection.executor)
      console.log('All application tables were cleared.')
    }

    await seedDatabase(new PostgresTicketStore(connection.db))
    console.log('Seed completed.')
  } finally {
    await connection.close()
  }
}

main().catch((error: unknown) => {
  console.error(`Seed failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
