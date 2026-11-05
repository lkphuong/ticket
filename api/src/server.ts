import { createApp } from './app.ts'
import { loadEnvironmentConfig } from './config/environment.ts'

// Entrypoint executing HTTP listener
const config = loadEnvironmentConfig()
const app = createApp(config)

const server = app.listen(config.port, () => {
  // Output technical operational state
  console.log(`API server listening on port ${config.port} [env=${config.nodeEnv}]`)
})

// Graceful termination handling
function terminate(signal: string): void {
  console.log(`Received ${signal}, shutting down server gracefully...`)
  server.close(() => {
    process.exit(0)
  })
}

process.on('SIGINT', () => terminate('SIGINT'))
process.on('SIGTERM', () => terminate('SIGTERM'))
