import { describe, expect, it } from 'bun:test'
import request from 'supertest'
import { createApp } from '../app.ts'
import { loadEnvironmentConfig } from '../config/environment.ts'

describe('GET /health', () => {
  it('should_return_200_and_health_metadata_when_endpoint_is_called', async () => {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const app = createApp(config)

    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.body.status).toBe('ok')
    expect(response.body.environment).toBe('development')
    expect(response.body.domain.activeStatuses).toEqual(['open', 'in_progress', 'waiting'])
  })

  it('should_return_404_when_route_does_not_exist', async () => {
    const config = loadEnvironmentConfig({ NODE_ENV: 'development', PORT: '3001' })
    const app = createApp(config)

    const response = await request(app).get('/non-existent-route')

    expect(response.status).toBe(404)
    expect(response.body.error).toBe('Not Found')
  })
})
