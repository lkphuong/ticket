import { loadEnvironmentConfig, requireMongoUri } from '../config/environment.ts'
import { confirmByTyping } from './confirmPrompt.ts'
import { createDatabaseConnection } from './connection.ts'
import { assertSeedAllowed } from './seedOptions.ts'

const DROP_CONFIRMATION_WORD = 'DROP'

// Lists every collection in MongoDB database, then drops them all after typed confirmation
async function main(): Promise<void> {
  const config = loadEnvironmentConfig()
  assertSeedAllowed(config.nodeEnv)

  const connection = createDatabaseConnection(requireMongoUri(config), config.mongodbDbName)
  try {
    const collections = await connection.db.listCollections().toArray()
    if (collections.length === 0) {
      console.log('The target database has no collections, nothing to drop.')
      return
    }

    console.log(`Collections found (${collections.length}): ${collections.map((c) => c.name).join(', ')}`)
    if (!(await confirmByTyping('All listed collections and their data will be deleted.', DROP_CONFIRMATION_WORD))) {
      console.log('Drop cancelled, nothing was changed.')
      return
    }

    for (const c of collections) {
      await connection.db.collection(c.name).drop()
    }
    console.log('All collections were dropped. Run db:migrate next.')
  } finally {
    await connection.close()
  }
}

main().catch((error: unknown) => {
  console.error(`Drop failed: ${error instanceof Error ? error.message : String(error)}`)
  process.exit(1)
})
