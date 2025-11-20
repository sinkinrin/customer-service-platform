/**
 * Zammad Service Health Check
 * 
 * Provides utilities to check if Zammad service is available
 */

let lastHealthCheck: {
  isHealthy: boolean
  timestamp: number
  error?: string
} = {
  isHealthy: false,
  timestamp: 0,
}

// Cache health check for 30 seconds
const HEALTH_CHECK_CACHE_MS = 30000

/**
 * Check if Zammad service is available
 */
export async function checkZammadHealth(): Promise<{
  isHealthy: boolean
  error?: string
}> {
  // Return cached result if recent
  const now = Date.now()
  if (now - lastHealthCheck.timestamp < HEALTH_CHECK_CACHE_MS) {
    return {
      isHealthy: lastHealthCheck.isHealthy,
      error: lastHealthCheck.error,
    }
  }

  const zammadUrl = process.env.ZAMMAD_URL
  const zammadToken = process.env.ZAMMAD_API_TOKEN

  // Check if Zammad is configured
  if (!zammadUrl || !zammadToken) {
    const error = 'Zammad service is not configured. Please set ZAMMAD_URL and ZAMMAD_API_TOKEN environment variables.'
    lastHealthCheck = {
      isHealthy: false,
      timestamp: now,
      error,
    }
    return { isHealthy: false, error }
  }

  try {
    // Try to connect to Zammad with a short timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 3000) // 3 second timeout

    const response = await fetch(`${zammadUrl}/api/v1/users/me`, {
      method: 'GET',
      headers: {
        'Authorization': `Token token=${zammadToken}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    if (response.ok) {
      lastHealthCheck = {
        isHealthy: true,
        timestamp: now,
      }
      return { isHealthy: true }
    } else {
      const error = `Zammad service returned status ${response.status}`
      lastHealthCheck = {
        isHealthy: false,
        timestamp: now,
        error,
      }
      return { isHealthy: false, error }
    }
  } catch (error) {
    let errorMessage = 'Zammad service is not available'
    
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        errorMessage = 'Zammad service connection timeout'
      } else if (error.message.includes('ECONNREFUSED')) {
        errorMessage = 'Zammad service connection refused. Please check if the service is running.'
      } else if (error.message.includes('ENOTFOUND')) {
        errorMessage = 'Zammad service host not found. Please check ZAMMAD_URL configuration.'
      } else {
        errorMessage = `Zammad service error: ${error.message}`
      }
    }

    lastHealthCheck = {
      isHealthy: false,
      timestamp: now,
      error: errorMessage,
    }
    return { isHealthy: false, error: errorMessage }
  }
}

/**
 * Get a user-friendly error message for Zammad unavailability
 */
export function getZammadUnavailableMessage(): string {
  return lastHealthCheck.error || 'Zammad ticketing service is currently unavailable. Please try again later or contact support.'
}

/**
 * Check if error is due to Zammad being unavailable
 */
export function isZammadUnavailableError(error: any): boolean {
  if (!error) return false
  
  const errorMessage = error.message || error.toString()
  return (
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('ENOTFOUND') ||
    errorMessage.includes('timeout') ||
    errorMessage.includes('Zammad URL and API Token are required')
  )
}

