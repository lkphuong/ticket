import { createApp } from './app.ts'
import { loadEnvironmentConfig, requireDatabaseUrl } from './config/environment.ts'
import { createDatabaseConnection } from './db/connection.ts'
import { runMigrations } from './db/migrator.ts'
import { DeadlineService } from './notifications/deadlineService.ts'
import { NotificationService } from './notifications/notificationService.ts'
import { FirebasePushGateway } from './notifications/pushGateway.ts'
import { PostgresTicketStore } from './repositories/postgresTicketStore.ts'

// Entrypoint executing HTTP listener
const config = loadEnvironmentConfig()

// Fail fast when the database is not configured instead of silently falling back to memory
const connection = createDatabaseConnection(requireDatabaseUrl(config))
await runMigrations(connection.executor)
const store = new PostgresTicketStore(connection.db)
const pushGateway = new FirebasePushGateway()
const notificationService = new NotificationService(store, undefined, () => new Date(), pushGateway)
const deadlineService = new DeadlineService(store, notificationService)

// Activate hourly periodic scan in production process
deadlineService.startHourlySchedule()

const app = createApp(config, {
  store,
  notificationService,
  deadlineService,
  pushGateway,
})

const server = app.listen(config.port, () => {
  // Output technical operational state
  console.log(`API server listening on port ${config.port} [env=${config.nodeEnv}]`)
})

// Graceful termination handling
function terminate(signal: string): void {
  console.log(`Received ${signal}, shutting down server gracefully...`)
  deadlineService.stopHourlySchedule()
  server.close(() => {
    connection.close().finally(() => process.exit(0))
  })
}

process.on('SIGINT', () => terminate('SIGINT'))
process.on('SIGTERM', () => terminate('SIGTERM'))
