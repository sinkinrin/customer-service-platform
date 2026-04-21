import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const originalEnv = { ...process.env }

describe('start-server script', () => {
  beforeEach(() => {
    vi.resetModules()
    Object.keys(process.env).forEach((key) => delete process.env[key])
    Object.assign(process.env, originalEnv)
    delete process.env.PORT
    delete process.env.HOST
  })

  afterEach(() => {
    Object.keys(process.env).forEach((key) => delete process.env[key])
    Object.assign(process.env, originalEnv)
  })

  it('uses platform-provided PORT and HOST when present', async () => {
    process.env.PORT = '4567'
    process.env.HOST = '127.0.0.1'

    const { getServerStartConfig, startServer } = await import('../../scripts/start-server.js')
    const spawnImpl = vi.fn(() => ({ killed: false }))

    expect(getServerStartConfig()).toEqual({ port: '4567', host: '127.0.0.1' })

    startServer({ spawnImpl, registerSignalHandlers: false })

    expect(spawnImpl).toHaveBeenCalledWith(
      process.execPath,
      [expect.stringContaining('next'), 'start', '-p', '4567', '-H', '127.0.0.1'],
      expect.objectContaining({
        env: process.env,
        stdio: 'inherit',
      })
    )
  })

  it('falls back to local defaults when PORT and HOST are unset', async () => {
    const { getServerStartConfig } = await import('../../scripts/start-server.js')

    expect(getServerStartConfig()).toEqual({ port: '3010', host: '0.0.0.0' })
  })
})
