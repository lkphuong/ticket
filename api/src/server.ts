import { createApp } from './app.ts'
import { loadEnvironmentConfig } from './config/environment.ts'
import { DeadlineService } from './notifications/deadlineService.ts'
import { NotificationService } from './notifications/notificationService.ts'
import { FirebasePushGateway } from './notifications/pushGateway.ts'
import { InMemoryTicketStore } from './repositories/inMemoryTicketStore.ts'

// Entrypoint executing HTTP listener
const config = loadEnvironmentConfig()
const store = new InMemoryTicketStore()
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
    process.exit(0)
  })
}

process.on('SIGINT', () => terminate('SIGINT'))
process.on('SIGTERM', () => terminate('SIGTERM'))
