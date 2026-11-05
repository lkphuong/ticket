// Environment configuration loader with runtime validation

export type Environment = 'development' | 'staging' | 'production'

export interface AppConfig {
  readonly nodeEnv: Environment
  readonly port: number
}

// Parses and validates port value to ensure bounded numeric network port
function parsePort(value: string | undefined, defaultPort: number): number {
  if (!value) return defaultPort
  const parsed = parseInt(value, 10)
  // Ensure valid non-privileged port range
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > 65535) {
    throw new Error(`Invalid PORT environment variable: ${value}`)
  }
  return parsed
}

// Validates deployment environment name to prevent configuration drift
function parseEnvironment(value: string | undefined): Environment {
  if (!value) return 'development'
  const normalized = value.trim().toLowerCase()
  if (normalized === 'development' || normalized === 'staging' || normalized === 'production') {
    return normalized
  }
  throw new Error(`Invalid NODE_ENV environment variable: ${value}. Expected development, staging, or production.`)
}

// Pure factory function constructing validated immutable application config
export function loadEnvironmentConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  return {
    nodeEnv: parseEnvironment(env.NODE_ENV),
    port: parsePort(env.PORT, 3001),
  }
}
