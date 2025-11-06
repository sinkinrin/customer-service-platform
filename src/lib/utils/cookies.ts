/**
 * Cookie Utilities for Session Management
 *
 * Provides both client-side and server-side cookie operations
 */

import Cookies from 'js-cookie'

const SESSION_COOKIE_NAME = 'auth-session'
const SESSION_MAX_AGE = 60 * 60 * 24 * 7 // 7 days in seconds

/**
 * Client-side cookie operations (browser only)
 */
export const clientCookies = {
  /**
   * Set session cookie (client-side)
   */
  setSession: (sessionData: any) => {
    if (typeof window === 'undefined') {
      console.warn('clientCookies.setSession called on server-side')
      return
    }
    
    Cookies.set(SESSION_COOKIE_NAME, JSON.stringify(sessionData), {
      expires: 7, // 7 days
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    })
  },

  /**
   * Get session cookie (client-side)
   */
  getSession: (): any | null => {
    if (typeof window === 'undefined') {
      console.warn('clientCookies.getSession called on server-side')
      return null
    }
    
    const sessionStr = Cookies.get(SESSION_COOKIE_NAME)
    if (!sessionStr) return null
    
    try {
      return JSON.parse(sessionStr)
    } catch (error) {
      console.error('Error parsing session cookie:', error)
      return null
    }
  },

  /**
   * Remove session cookie (client-side)
   */
  removeSession: () => {
    if (typeof window === 'undefined') {
      console.warn('clientCookies.removeSession called on server-side')
      return
    }
    
    Cookies.remove(SESSION_COOKIE_NAME)
  },
}

/**
 * Server-side cookie operations (API routes only)
 */
export const serverCookies = {
  /**
   * Get session cookie (server-side)
   * Note: This function dynamically imports next/headers to avoid client-side errors
   */
  getSession: async (): Promise<any | null> => {
    if (typeof window !== 'undefined') {
      console.warn('serverCookies.getSession called on client-side')
      return null
    }

    try {
      // Dynamic import to avoid client-side bundling issues
      const { cookies } = await import('next/headers')
      const cookieStore = await cookies()
      const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)

      if (!sessionCookie?.value) return null

      return JSON.parse(sessionCookie.value)
    } catch (error) {
      console.error('Error reading session cookie on server:', error)
      return null
    }
  },

  /**
   * Parse cookies from request headers (alternative server-side method)
   */
  getSessionFromHeaders: (cookieHeader: string | null): any | null => {
    if (!cookieHeader) return null

    try {
      const cookies = cookieHeader.split(';').map(c => c.trim())
      const sessionCookie = cookies.find(c => c.startsWith(`${SESSION_COOKIE_NAME}=`))

      if (!sessionCookie) return null

      const sessionStr = sessionCookie.substring(SESSION_COOKIE_NAME.length + 1)
      return JSON.parse(decodeURIComponent(sessionStr))
    } catch (error) {
      console.error('Error parsing session from cookie header:', error)
      return null
    }
  },

  /**
   * Set session cookie (server-side)
   * Note: This should be done via Set-Cookie header in API response
   */
  setSessionHeader: (sessionData: any): string => {
    const sessionStr = JSON.stringify(sessionData)
    const maxAge = SESSION_MAX_AGE
    const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : ''

    return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionStr)}; Max-Age=${maxAge}; Path=/; SameSite=Lax; ${secure}`
  },

  /**
   * Remove session cookie (server-side)
   * Note: This should be done via Set-Cookie header in API response
   */
  removeSessionHeader: (): string => {
    return `${SESSION_COOKIE_NAME}=; Max-Age=0; Path=/; SameSite=Lax`
  },
}

/**
 * Universal cookie operations (works on both client and server)
 */
export const universalCookies = {
  /**
   * Get session - works on both client and server
   */
  getSession: async (): Promise<any | null> => {
    if (typeof window !== 'undefined') {
      // Client-side
      return clientCookies.getSession()
    } else {
      // Server-side
      return await serverCookies.getSession()
    }
  },
}

