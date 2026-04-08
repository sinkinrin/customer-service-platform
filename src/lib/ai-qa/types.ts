/**
 * AI QA Review Types
 *
 * Type definitions for the Q&A review system.
 */

/** Review status — null means unreviewed (no AiQaReview record exists) */
export type ReviewStatus = 'correct' | 'incorrect'

/** Filter status for listing */
export type FilterStatus = 'all' | 'unreviewed' | 'correct' | 'incorrect'

/** Customer rating from AiMessageRating */
export type CustomerRating = 'positive' | 'negative' | null

/** A single Q&A round for the listing */
export interface QaRound {
  messageId: string
  question: string
  answer: string
  customerEmail: string
  customerRating: CustomerRating
  customerFeedback: string | null
  reviewStatus: ReviewStatus | null
  reviewNote: string | null
  retestAnswer: string | null
  retestAt: string | null
  qaTime: string
  conversationId: string
}

/** Aggregate statistics for the current query */
export interface QaStats {
  total: number
  unreviewed: number
  correct: number
  incorrect: number
}

/** Response shape for GET /api/staff/ai-qa/rounds */
export interface QaRoundsResponse {
  rounds: QaRound[]
  total: number
  page: number
  pageSize: number
  stats: QaStats
}

/** Request body for POST /api/staff/ai-qa/review */
export interface ReviewRequest {
  messageId: string
  status: ReviewStatus
  reviewNote?: string
}

/** Response shape for POST /api/staff/ai-qa/review */
export interface ReviewResponse {
  messageId: string
  status: ReviewStatus
  reviewNote: string | null
  reviewedBy: string
  reviewedAt: string
}

/** Request body for POST /api/staff/ai-qa/retest */
export interface RetestRequest {
  messageId: string
}

/** Response shape for POST /api/staff/ai-qa/retest */
export interface RetestResponse {
  originalAnswer: string
  retestAnswer: string
  retestAppId: string | null
  retestAt: string
}

/** Parameters for rounds-service query */
export interface RoundsQueryParams {
  status: FilterStatus
  from: Date
  to: Date
  page: number
  pageSize: number
}
