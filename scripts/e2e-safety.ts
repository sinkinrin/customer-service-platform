const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

function parseRequiredUrl(value: string | undefined, variableName: string): URL {
  if (!value) {
    throw new Error(`${variableName} is required for isolated E2E tests`)
  }

  try {
    return new URL(value)
  } catch {
    throw new Error(`${variableName} must be a valid URL for isolated E2E tests`)
  }
}

function isLoopbackUrl(url: URL): boolean {
  return LOOPBACK_HOSTNAMES.has(url.hostname.toLowerCase())
}

export function assertSafeE2EEnvironment(
  env: NodeJS.ProcessEnv = process.env
): void {
  if (env.RUN_ISOLATED_E2E !== 'true') {
    throw new Error(
      'E2E tests are write-capable and disabled by default. Set RUN_ISOLATED_E2E=true only for an isolated environment.'
    )
  }

  const databaseUrl = parseRequiredUrl(env.DATABASE_URL, 'DATABASE_URL')
  const databaseName = databaseUrl.pathname.replace(/^\//, '').toLowerCase()
  if (!databaseName.includes('test')) {
    throw new Error('Isolated E2E DATABASE_URL must reference a database whose name contains "test"')
  }

  const zammadUrl = parseRequiredUrl(env.ZAMMAD_URL, 'ZAMMAD_URL')
  const allowRemoteServices = env.ALLOW_REMOTE_E2E_SERVICES === 'true'

  if (!allowRemoteServices && (!isLoopbackUrl(databaseUrl) || !isLoopbackUrl(zammadUrl))) {
    throw new Error(
      'Remote E2E services are disabled by default. Use loopback services or explicitly set ALLOW_REMOTE_E2E_SERVICES=true for dedicated test systems.'
    )
  }
}
