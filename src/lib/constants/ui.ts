/**
 * UI Constants
 * Centralized configuration for UI elements like skeleton screens, transitions, etc.
 */

/**
 * Skeleton screen configuration
 */
export const SKELETON_CONFIG = {
  /** Default number of skeleton items for ticket lists */
  TICKET_LIST_COUNT: 5,
  /** Default number of skeleton items for user lists */
  USER_LIST_COUNT: 5,
  /** Default number of skeleton items for notification lists */
  NOTIFICATION_LIST_COUNT: 3,
} as const

/**
 * Transition duration constants (in milliseconds)
 * These match the CSS variables in globals.css
 */
export const TRANSITION_DURATION = {
  FAST: 150,
  NORMAL: 200,
  SLOW: 300,
} as const

/**
 * CSS transition timing function presets
 */
export const TRANSITION_TIMING = {
  DEFAULT: "cubic-bezier(0.4, 0, 0.2, 1)",
  IN: "cubic-bezier(0.4, 0, 1, 1)",
  OUT: "cubic-bezier(0, 0, 0.2, 1)",
} as const
