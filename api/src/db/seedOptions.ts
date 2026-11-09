import type { Environment } from '../config/environment.ts'

export interface SeedOptions {
  readonly reset: boolean
  readonly assumeYes: boolean
  readonly adminOnly: boolean
}

// Parses command line flags for the seed script and rejects anything unknown to avoid silent typos
export function parseSeedOptions(argv: readonly string[]): SeedOptions {
  const known = new Set(['--reset', '--yes', '--admin-only'])
  const unknown = argv.filter((arg) => !known.has(arg))
  if (unknown.length > 0) {
    throw new Error(`Unknown seed option(s): ${unknown.join(', ')}. Supported options: --reset, --yes, --admin-only.`)
  }
  return { reset: argv.includes('--reset'), assumeYes: argv.includes('--yes'), adminOnly: argv.includes('--admin-only') }
}

// Demo accounts share a well known password, so seeding is refused in production
export function assertSeedAllowed(nodeEnv: Environment): void {
  if (nodeEnv === 'production') {
    throw new Error('Refusing to seed demo data because NODE_ENV is production.')
  }
}
