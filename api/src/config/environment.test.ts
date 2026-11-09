import { describe, expect, it } from 'bun:test'
import { loadEnvironmentConfig, requireMongoUri } from './environment.ts'

const PRODUCTION_VARIABLES = {
  NODE_ENV: 'production',
  RESEND_API_KEY: 're_test_key',
  RESEND_FROM_EMAIL: 'VTDesk <no-reply@example.com>',
  OTP_HMAC_SECRET: '0123456789abcdef0123456789abcdef',
}

describe('loadEnvironmentConfig', () => {
  it('should_use_default_values_when_environment_variables_are_missing', () => {
    const config = loadEnvironmentConfig({})
    expect(config.nodeEnv).toBe('development')
    expect(config.port).toBe(3001)
    expect(config.mongodbDbName).toBe('ticket')
  })

  it('should_load_staging_environment_when_specified', () => {
    const config = loadEnvironmentConfig({ NODE_ENV: 'staging', PORT: '8080' })
    expect(config.nodeEnv).toBe('staging')
    expect(config.port).toBe(8080)
  })

  it('should_load_production_environment_when_specified', () => {
    const config = loadEnvironmentConfig({ ...PRODUCTION_VARIABLES, PORT: '4000' })
    expect(config.nodeEnv).toBe('production')
    expect(config.port).toBe(4000)
  })

  it('should_throw_listing_missing_variables_when_production_lacks_email_and_otp_settings', () => {
    expect(() => loadEnvironmentConfig({ NODE_ENV: 'production' })).toThrow(
      'RESEND_API_KEY, RESEND_FROM_EMAIL, OTP_HMAC_SECRET',
    )
  })

  it('should_expose_email_and_otp_settings_when_variables_are_set', () => {
    const config = loadEnvironmentConfig({ ...PRODUCTION_VARIABLES, RESEND_API_KEY: ' re_key ' })
    expect(config.resendApiKey).toBe('re_key')
    expect(config.resendFromEmail).toBe('VTDesk <no-reply@example.com>')
    expect(config.otpHmacSecret).toBe('0123456789abcdef0123456789abcdef')
  })

  it('should_leave_email_and_otp_settings_undefined_when_development_omits_them', () => {
    const config = loadEnvironmentConfig({})
    expect(config.resendApiKey).toBeUndefined()
    expect(config.otpHmacSecret).toBeUndefined()
  })

  it('should_throw_error_when_node_env_is_unrecognized', () => {
    expect(() => loadEnvironmentConfig({ NODE_ENV: 'invalid_env' })).toThrow()
  })

  it('should_throw_error_when_port_is_out_of_range', () => {
    expect(() => loadEnvironmentConfig({ PORT: '70000' })).toThrow()
  })

  it('should_expose_mongodb_uri_and_database_name_when_variable_is_set', () => {
    const config = loadEnvironmentConfig({
      MONGODB_URI: 'mongodb+srv://user:pass@cluster.mongodb.net/',
      MONGODB_DB_NAME: 'vtdesk_ticket',
    })
    expect(config.mongodbUri).toBe('mongodb+srv://user:pass@cluster.mongodb.net/')
    expect(config.mongodbDbName).toBe('vtdesk_ticket')
  })

  it('should_throw_actionable_error_when_mongodb_uri_is_required_but_missing', () => {
    const config = loadEnvironmentConfig({})
    expect(() => requireMongoUri(config)).toThrow('MONGODB_URI')
  })
})
