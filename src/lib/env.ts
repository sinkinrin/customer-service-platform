/**
 * Environment Variable Management
 *
 * Centralized environment variable validation and access
 * Validates required variables at startup and provides type-safe access
 */

/**
 * Environment configuration schema
 */
interface EnvConfig {
  // NextAuth
  AUTH_SECRET: string
  NEXTAUTH_URL?: string

  // Production fallback user (when mock auth is disabled)
  AUTH_DEFAULT_USER_EMAIL?: string
  AUTH_DEFAULT_USER_PASSWORD?: string
  AUTH_DEFAULT_USER_ROLE?: "customer" | "staff" | "admin"
  AUTH_DEFAULT_USER_NAME?: string
  AUTH_DEFAULT_USER_REGION?: string

  // Mock Authentication Control
  NEXT_PUBLIC_ENABLE_MOCK_AUTH?: string

  // Zammad Integration
  ZAMMAD_URL: string
  ZAMMAD_API_TOKEN: string

  // Database
  DATABASE_URL?: string

  // AI Configuration
  FASTGPT_API_KEY?: string

  // Logging
  LOG_LEVEL?: string

  // Node Environment
  NODE_ENV: string

  // Email User Welcome
  EMAIL_USER_AUTO_PASSWORD_ENABLED: boolean
  EMAIL_USER_WELCOME_EMAIL_ENABLED: boolean
  WEB_PLATFORM_URL?: string
}

/**
 * Required environment variables for production
 */
const REQUIRED_PRODUCTION_VARS = [
  "AUTH_SECRET",
  "DATABASE_URL",
  "ZAMMAD_URL",
  "ZAMMAD_API_TOKEN",
] as const

/**
 * Required environment variables for development
 */
const REQUIRED_DEV_VARS = [
  "DATABASE_URL",
  "ZAMMAD_URL",
  "ZAMMAD_API_TOKEN",
] as const

/**
 * Helper to check if an auth secret is configured
 * Accepts both AUTH_SECRET and NEXTAUTH_SECRET for compatibility
 */
export function hasAuthSecret(): boolean {
  return !!(process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET)
}

/**
 * Get the configured auth secret
 * Prefers AUTH_SECRET, falls back to NEXTAUTH_SECRET
 */
export function getAuthSecret(): string {
  return process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || ""
}

/**
 * Validate environment variables
 * Throws error if required variables are missing
 */
export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === "production"
  const requiredVars = isProduction ? REQUIRED_PRODUCTION_VARS : REQUIRED_DEV_VARS

  const missingVars: string[] = []

  for (const varName of requiredVars) {
    // Special handling for AUTH_SECRET: accept NEXTAUTH_SECRET as alternative
    if (varName === "AUTH_SECRET") {
      if (!hasAuthSecret()) {
        missingVars.push("AUTH_SECRET (or NEXTAUTH_SECRET)")
      }
    } else if (!process.env[varName]) {
      missingVars.push(varName)
    }
  }

  if (missingVars.length > 0) {
    const errorMessage = `Missing required environment variables: ${missingVars.join(", ")}`
    if (isProduction) {
      throw new Error(errorMessage)
    } else {
      console.warn(`[ENV WARNING] ${errorMessage}`)
    }
  }

  // Additional production-specific validations
  if (isProduction) {
    // Ensure AUTH_SECRET is sufficiently long
    const authSecret = getAuthSecret()
    if (authSecret && authSecret.length < 32) {
      throw new Error("AUTH_SECRET (or NEXTAUTH_SECRET) must be at least 32 characters in production")
    }

    // Ensure mock auth is not accidentally enabled in production
    if (process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true") {
      console.warn(
        "[SECURITY WARNING] Mock authentication is enabled in production. " +
          "This should only be used for testing purposes."
      )
    }
  }
}

/**
 * Get environment configuration
 * Returns typed environment variables with defaults
 */
export function getEnv(): EnvConfig {
  return {
    AUTH_SECRET: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "",
    NEXTAUTH_URL: process.env.NEXTAUTH_URL,
    AUTH_DEFAULT_USER_EMAIL: process.env.AUTH_DEFAULT_USER_EMAIL,
    AUTH_DEFAULT_USER_PASSWORD: process.env.AUTH_DEFAULT_USER_PASSWORD,
    AUTH_DEFAULT_USER_ROLE: process.env.AUTH_DEFAULT_USER_ROLE as
      | "customer"
      | "staff"
      | "admin"
      | undefined,
    AUTH_DEFAULT_USER_NAME: process.env.AUTH_DEFAULT_USER_NAME,
    AUTH_DEFAULT_USER_REGION: process.env.AUTH_DEFAULT_USER_REGION,
    NEXT_PUBLIC_ENABLE_MOCK_AUTH: process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH,
    ZAMMAD_URL: process.env.ZAMMAD_URL || "",
    ZAMMAD_API_TOKEN: process.env.ZAMMAD_API_TOKEN || "",
    DATABASE_URL: process.env.DATABASE_URL,
    FASTGPT_API_KEY: process.env.FASTGPT_API_KEY,
    LOG_LEVEL: process.env.LOG_LEVEL || "info",
    NODE_ENV: process.env.NODE_ENV || "development",
    EMAIL_USER_AUTO_PASSWORD_ENABLED: process.env.EMAIL_USER_AUTO_PASSWORD_ENABLED !== "false",
    EMAIL_USER_WELCOME_EMAIL_ENABLED: process.env.EMAIL_USER_WELCOME_EMAIL_ENABLED !== "false",
    WEB_PLATFORM_URL: process.env.WEB_PLATFORM_URL,
  }
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return process.env.NODE_ENV === "production"
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return process.env.NODE_ENV !== "production"
}

/**
 * Check if mock authentication is enabled
 */
export function isMockAuthEnabled(): boolean {
  if (process.env.NODE_ENV !== "production") {
    return true
  }
  return process.env.NEXT_PUBLIC_ENABLE_MOCK_AUTH === "true"
}

// Export singleton instance for easy access
export const env = getEnv()

type EnvValidationMode = "none" | "non-strict" | "strict"
let envValidatedMode: EnvValidationMode = "none"

/**
 * Ensure environment validation is executed once per runtime
 * Useful for server entrypoints to fail fast in production
 */
export function ensureEnvValidation(options?: { strict?: boolean }): void {
  const strict = options?.strict ?? process.env.NODE_ENV === "production"

  // Skip redundant validations:
  // - if already validated in strict mode
  // - if already validated in non-strict mode and current call is also non-strict
  if (envValidatedMode === "strict") return
  if (envValidatedMode === "non-strict" && !strict) return

  try {
    validateEnv()
    envValidatedMode = strict ? "strict" : "non-strict"
  } catch (error) {
    if (strict) {
      throw error
    }
    console.warn("[ENV WARNING] Validation failed in non-strict mode:", error)
    envValidatedMode = "non-strict"
  }
}
