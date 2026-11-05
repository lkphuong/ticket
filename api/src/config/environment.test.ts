import { describe, expect, it } from 'bun:test'
import { loadEnvironmentConfig, requireDatabaseUrl } from './environment.ts'

describe('loadEnvironmentConfig', () => {
  it('should_use_default_values_when_environment_variables_are_missing', () => {
    const config = loadEnvironmentConfig({})
    expect(config.nodeEnv).toBe('development')
    expect(config.port).toBe(3001)
  })

  it('should_load_staging_environment_when_specified', () => {
    const config = loadEnvironmentConfig({ NODE_ENV: 'staging', PORT: '8080' })
    expect(config.nodeEnv).toBe('staging')
    expect(config.port).toBe(8080)
  })

  it('should_load_production_environment_when_specified', () => {
    const config = loadEnvironmentConfig({ NODE_ENV: 'production', PORT: '4000' })
    expect(config.nodeEnv).toBe('production')
    expect(config.port).toBe(4000)
  })

  it('should_throw_error_when_node_env_is_unrecognized', () => {
    expect(() => loadEnvironmentConfig({ NODE_ENV: 'invalid_env' })).toThrow()
  })

  it('should_throw_error_when_port_is_out_of_range', () => {
    expect(() => loadEnvironmentConfig({ PORT: '70000' })).toThrow()
  })

  it('should_expose_database_url_when_variable_is_set', () => {
    const config = loadEnvironmentConfig({ DATABASE_URL: ' postgres://user@host:5432/db ' })
    expect(config.databaseUrl).toBe('postgres://user@host:5432/db')
  })

  it('should_throw_actionable_error_when_database_url_is_required_but_missing', () => {
    const config = loadEnvironmentConfig({})
    expect(() => requireDatabaseUrl(config)).toThrow('DATABASE_URL')
  })
})
