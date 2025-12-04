/**
 * NextAuth.js API Route Handler
 *
 * Handles all authentication requests:
 * - GET /api/auth/signin - Sign in page
 * - POST /api/auth/signin - Sign in action
 * - GET /api/auth/signout - Sign out page
 * - POST /api/auth/signout - Sign out action
 * - GET /api/auth/session - Get session
 * - GET /api/auth/csrf - Get CSRF token
 * - GET /api/auth/providers - Get available providers
 * - GET /api/auth/callback/:provider - OAuth callback
 */

import { handlers } from "@/auth"

export const { GET, POST } = handlers
