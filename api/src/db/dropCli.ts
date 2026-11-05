import { loadEnvironmentConfig, requireDatabaseUrl } from '../config/environment.ts'
import { confirmByTyping } from './confirmPrompt.ts'
import { createDatabaseConnection } from './connection.ts'
import { assertSeedAllowed } from './seedOptions.ts'

const DROP_CONFIRMATION_WORD = 'DROP'

// Lists every table in the public schema, then drops them all after typed confirmation so migrations can start from scratch
async function main(): Promise<void> {
  const config = loadEnvironmentConfig()
  assertSeedAllowed(config.nodeEnv)

  const connection = createDatabaseConnection(requireDatabaseUrl(config))
  try {
    const rows = (await connection.executor.exec(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name;",
    )) as { table_name: string }[]
    if (rows.length === 0) {
      console.log('The public schema has no tables, nothing to drop.')
      return
    }

    console.log(`Tables found (${rows.length}): ${rows.map((row) => row.table_name).join(', ')}`)
    if (!(await confirmByTyping('All listed tables and their data will be deleted.', DROP_CONFIRMATION_WORD))) {
      console.log('Drop cancelled, nothing was changed.')
      return
    }

    for (const row of rows) {
      await connection.executor.exec(`DROP TABLE IF EXISTS "${row.table_name}" CASCADE;`)
    }
    console.log('All tables were dropped. Run db:migrate next.')
  } finally {
    await connection.close()
  }
}

main().catch((error: unknown) => {
  console.error(`Drop failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
