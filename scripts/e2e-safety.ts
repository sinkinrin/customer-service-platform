const LOOPBACK_HOSTNAMES = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])
const TEST_DATABASE_NAME_SEGMENTS = new Set(['test', 'e2e'])

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

export function hasExplicitTestDatabaseSegment(databaseName: string): boolean {
  return databaseName
    .toLowerCase()
    .split(/[._-]+/)
    .some(segment => TEST_DATABASE_NAME_SEGMENTS.has(segment))
}

export function isExplicitTestDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false

  try {
    const parsedUrl = new URL(databaseUrl)
    const databaseName = parsedUrl.pathname.replace(/^\/+/, '')
    return hasExplicitTestDatabaseSegment(databaseName)
  } catch {
    return false
  }
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
  const databaseName = databaseUrl.pathname.replace(/^\/+/, '')
  if (!hasExplicitTestDatabaseSegment(databaseName)) {
    throw new Error(
      'Isolated E2E DATABASE_URL must reference a database with an explicit "test" or "e2e" name segment separated by ., _, or -'
    )
  }

  const zammadUrl = parseRequiredUrl(env.ZAMMAD_URL, 'ZAMMAD_URL')
  const allowRemoteServices = env.ALLOW_REMOTE_E2E_SERVICES === 'true'

  if (!allowRemoteServices && (!isLoopbackUrl(databaseUrl) || !isLoopbackUrl(zammadUrl))) {
    throw new Error(
      'Remote E2E services are disabled by default. Use loopback services or explicitly set ALLOW_REMOTE_E2E_SERVICES=true for dedicated test systems.'
    )
  }
}
