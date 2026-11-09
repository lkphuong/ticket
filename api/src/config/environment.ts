// Environment configuration loader with runtime validation

export type Environment = 'development' | 'staging' | 'production'

export interface AppConfig {
  readonly nodeEnv: Environment
  readonly port: number
  readonly mongodbUri?: string
  readonly mongodbDbName: string
  readonly resendApiKey?: string
  readonly resendFromEmail?: string
  readonly otpHmacSecret?: string
  readonly uploadDir: string
  readonly adminInitialPassword?: string
}

const DEFAULT_PORT = 3001
const DEFAULT_DATABASE_NAME = 'ticket'
const DEFAULT_UPLOAD_DIR = './uploads'
const MAX_NETWORK_PORT = 65535
const PRODUCTION_REQUIRED_VARIABLES = ['RESEND_API_KEY', 'RESEND_FROM_EMAIL', 'OTP_HMAC_SECRET'] as const

// Parses and validates port value to ensure bounded numeric network port
function parsePort(value: string | undefined, defaultPort: number): number {
  if (!value) return defaultPort
  const parsed = parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed <= 0 || parsed > MAX_NETWORK_PORT) {
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

// Production must deliver real verification emails and hash OTP codes with a stable secret
function assertProductionVariables(env: Record<string, string | undefined>): void {
  const missing = PRODUCTION_REQUIRED_VARIABLES.filter((name) => !env[name]?.trim())
  if (missing.length > 0) {
    throw new Error(`Missing required production environment variables: ${missing.join(', ')}.`)
  }
}

// Pure factory function constructing validated immutable application config
export function loadEnvironmentConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const nodeEnv = parseEnvironment(env.NODE_ENV)
  if (nodeEnv === 'production') assertProductionVariables(env)

  return {
    nodeEnv,
    port: parsePort(env.PORT, DEFAULT_PORT),
    mongodbUri: env.MONGODB_URI?.trim() || undefined,
    mongodbDbName: env.MONGODB_DB_NAME?.trim() || DEFAULT_DATABASE_NAME,
    resendApiKey: env.RESEND_API_KEY?.trim() || undefined,
    resendFromEmail: env.RESEND_FROM_EMAIL?.trim() || undefined,
    otpHmacSecret: env.OTP_HMAC_SECRET?.trim() || undefined,
    uploadDir: env.UPLOAD_DIR?.trim() || DEFAULT_UPLOAD_DIR,
    adminInitialPassword: env.ADMIN_INITIAL_PASSWORD?.trim() || undefined,
  }
}

// Returns the configured MongoDB connection string or fails fast with an actionable message
export function requireMongoUri(config: AppConfig): string {
  if (!config.mongodbUri) {
    throw new Error('MONGODB_URI environment variable is required to start the API. Set it in api/.env.')
  }
  return config.mongodbUri
}
