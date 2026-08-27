/**
 * User Profile API
 *
 * GET /api/user/profile - Get current user profile
 * PUT /api/user/profile - Update current user profile (name, phone)
 */

import { NextRequest } from 'next/server'
import { requireAuth } from '@/lib/utils/auth'
import {
  successResponse,
  errorResponse,
  validationErrorResponse,
  serverErrorResponse,
} from '@/lib/utils/api-response'
import { zammadClient } from '@/lib/zammad/client'
import { z } from 'zod'
import { logger } from '@/lib/utils/logger'

const SUPPORTED_LOCALES = ['en', 'zh-CN', 'fr', 'es', 'ru', 'pt'] as const

const UpdateProfileSchema = z.object({
  full_name: z.string().trim().min(1, 'Name is required').optional(),
  phone: z.string().optional(),
  language: z.enum(SUPPORTED_LOCALES).optional(),
})

type ZammadProfileUser = Awaited<ReturnType<typeof zammadClient.getUser>>
type ProfileUpdateData = Parameters<typeof zammadClient.updateUser>[1]

function getStoredLocale(preferences: Record<string, unknown> | undefined): string | null {
  const locale = preferences?.locale
  return typeof locale === 'string' && locale.length > 0 ? locale : null
}

function getErrorMessage(error: unknown): unknown {
  return error instanceof Error ? error.message : error
}

function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) {
    return undefined
  }

  const status = (error as { status?: unknown }).status
  return typeof status === 'number' ? status : undefined
}

function isDefiniteClientRejection(status: number | undefined): status is number {
  return status !== undefined && status >= 400 && status < 500 && status !== 408
}

function profileMatchesUpdate(user: ZammadProfileUser, updateData: ProfileUpdateData): boolean {
  return (
    (updateData.firstname === undefined || user.firstname === updateData.firstname) &&
    (updateData.lastname === undefined || user.lastname === updateData.lastname) &&
    (updateData.phone === undefined || (user.phone || '') === updateData.phone)
  )
}

function requestedProfileFields(updateData: ProfileUpdateData): string[] {
  const fields: string[] = []
  if (updateData.firstname !== undefined || updateData.lastname !== undefined) fields.push('full_name')
  if (updateData.phone !== undefined) fields.push('phone')
  return fields
}

function outcomeUnconfirmedResponse(
  phase: 'profile' | 'locale',
  details: Record<string, unknown>
) {
  return errorResponse(
    'OUTCOME_UNCONFIRMED',
    'The profile update may have succeeded, but its outcome could not be confirmed. Refresh the profile before trying again.',
    { phase, ...details },
    503
  )
}

function identityChangedResponse() {
  return errorResponse(
    'IDENTITY_CHANGED',
    'The authenticated user changed before this request was processed. Reload settings and try again.',
    undefined,
    409
  )
}

function hasExpectedUserMismatch(request: NextRequest | undefined, userId: string): boolean {
  const expectedUserId = request?.headers.get('x-csp-expected-user-id')
  return Boolean(expectedUserId && expectedUserId !== userId)
}

export async function GET(request?: NextRequest) {
  try {
    const user = await requireAuth()

    if (hasExpectedUserMismatch(request, user.id)) {
      return identityChangedResponse()
    }

    const zammadId = user.zammad_id

    // If user has a Zammad ID, fetch latest data from Zammad
    if (zammadId) {
      try {
        const zammadUser = await zammadClient.getUser(zammadId)
        return successResponse({
          profile: {
            id: user.id,
            email: zammadUser.email,
            full_name: `${zammadUser.firstname || ''} ${zammadUser.lastname || ''}`.trim(),
            phone: zammadUser.phone || '',
            language: zammadUser.preferences?.locale || user.language || 'zh-CN',
            avatar_url: user.avatar_url,
            region: user.region,
          },
        })
      } catch (zammadError) {
        // Fall back to session data if Zammad fetch fails
        logger.warning('UserProfile', 'Failed to fetch from Zammad, using session data', { data: { error: zammadError instanceof Error ? zammadError.message : zammadError } })
      }
    }

    // Fall back to session data (for mock users or if Zammad fetch failed)
    return successResponse({
      profile: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        phone: user.phone || '',
        language: user.language || 'zh-CN',
        avatar_url: user.avatar_url,
        region: user.region,
      },
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    logger.error('UserProfile', 'Failed to get profile', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse('Failed to get profile')
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth()

    if (hasExpectedUserMismatch(request, user.id)) {
      return identityChangedResponse()
    }

    const body = await request.json()
    const validation = UpdateProfileSchema.safeParse(body)

    if (!validation.success) {
      return validationErrorResponse(validation.error.errors)
    }

    const { full_name, phone, language } = validation.data

    // Get Zammad user ID from session
    const zammadId = user.zammad_id
    if (!zammadId) {
      // For mock users without Zammad ID, just return success
      // In production, all users should have a Zammad ID
      return successResponse({
        outcome: 'complete',
        profile: {
          id: user.id,
          email: user.email,
          full_name: full_name || user.full_name,
          phone: phone || user.phone || '',
          language: language || user.language || 'zh-CN',
        },
        message: 'Profile updated (local only - no Zammad ID)',
      })
    }

    // Build update data for Zammad
    const updateData: ProfileUpdateData = {}

    if (full_name) {
      // Split full_name into firstname and lastname
      const parts = full_name.trim().split(/\s+/)
      updateData.firstname = parts[0] || ''
      updateData.lastname = parts.slice(1).join(' ') || ''
    }

    if (phone !== undefined) {
      updateData.phone = phone
    }

    // Update ordinary profile fields without touching the serialized
    // preferences object. A failed write response can be ambiguous, so read
    // back and compare only the fields from this request before continuing to
    // the independent locale write.
    const hasProfileFieldUpdates = Object.keys(updateData).length > 0
    let profileStatus: 'unchanged' | 'updated' | 'confirmed-after-error' = 'unchanged'
    let updatedUser: ZammadProfileUser

    if (hasProfileFieldUpdates) {
      try {
        updatedUser = await zammadClient.updateUser(zammadId, updateData)
        profileStatus = 'updated'
      } catch (profileError) {
        const status = getHttpStatus(profileError)

        if (isDefiniteClientRejection(status)) {
          return status === 404
            ? errorResponse('NOT_FOUND', 'Zammad user not found', undefined, 404)
            : errorResponse(
                'PROFILE_REJECTED',
                'Zammad rejected the profile update',
                { upstreamStatus: status },
                502
              )
        }

        let confirmedUser: ZammadProfileUser
        try {
          confirmedUser = await zammadClient.getUser(zammadId)
        } catch (confirmationError) {
          logger.warning('UserProfile', 'Profile update outcome could not be confirmed', {
            data: {
              zammadId,
              fields: requestedProfileFields(updateData),
              profileError: getErrorMessage(profileError),
              confirmationError: getErrorMessage(confirmationError),
            },
          })
          return outcomeUnconfirmedResponse('profile', {
            fields: requestedProfileFields(updateData),
          })
        }

        if (!profileMatchesUpdate(confirmedUser, updateData)) {
          logger.warning('UserProfile', 'Profile update does not yet match after an ambiguous write error', {
            data: {
              zammadId,
              fields: requestedProfileFields(updateData),
              profileError: getErrorMessage(profileError),
            },
          })
          return outcomeUnconfirmedResponse('profile', {
            fields: requestedProfileFields(updateData),
          })
        }

        updatedUser = confirmedUser
        profileStatus = 'confirmed-after-error'
        logger.warning('UserProfile', 'Profile response failed but requested fields are confirmed', {
          data: {
            zammadId,
            fields: requestedProfileFields(updateData),
            profileError: getErrorMessage(profileError),
          },
        })
      }
    } else {
      updatedUser = await zammadClient.getUser(zammadId)
    }

    const committedLanguage = getStoredLocale(updatedUser.preferences)
      || user.language
      || 'zh-CN'
    const committedProfile = {
      id: user.id,
      email: updatedUser.email,
      full_name: `${updatedUser.firstname || ''} ${updatedUser.lastname || ''}`.trim(),
      phone: updatedUser.phone || '',
      language: committedLanguage,
    }

    if (language) {
      // Zammad's dedicated endpoint updates only the supplied preference key
      // under a row lock. This prevents a concurrent notification-preference
      // update from being overwritten by a stale whole-object write.
      try {
        await zammadClient.updateCurrentUserPreferences(
          { locale: language },
          String(zammadId)
        )
      } catch (localeError) {
        const localeHttpStatus = getHttpStatus(localeError)
        try {
          const confirmedUser = await zammadClient.getUser(zammadId)
          const actualLocale = getStoredLocale(confirmedUser.preferences)

          // The write may have committed even though its response was lost.
          if (actualLocale === language) {
            return successResponse({
              outcome: 'complete',
              profileStatus,
              profile: {
                ...committedProfile,
                language,
              },
              message: 'Profile updated successfully',
            })
          }

          if (!hasProfileFieldUpdates) {
            if (isDefiniteClientRejection(localeHttpStatus)) {
              return localeHttpStatus === 404
                ? errorResponse('NOT_FOUND', 'Zammad user not found', undefined, 404)
                : errorResponse(
                    'LOCALE_REJECTED',
                    'Zammad rejected the language update',
                    { upstreamStatus: localeHttpStatus },
                    502
                  )
            }

            logger.warning('UserProfile', 'Locale-only update outcome remains unconfirmed', {
              data: {
                zammadId,
                requestedLocale: language,
                actualLocale,
                localeError: getErrorMessage(localeError),
              },
            })
            return outcomeUnconfirmedResponse('locale', {
              requestedLocale: language,
              observedLocale: actualLocale,
            })
          }

          const localeStatus = isDefiniteClientRejection(localeHttpStatus)
            ? 'rejected'
            : 'unconfirmed'

          logger.warning('UserProfile', localeStatus === 'rejected'
            ? 'Profile fields updated but locale update was rejected'
            : 'Profile fields updated but locale outcome remains unconfirmed', {
            data: {
              zammadId,
              requestedLocale: language,
              actualLocale,
              localeError: getErrorMessage(localeError),
            },
          })

          return successResponse({
            outcome: 'partial',
            profileStatus,
            profile: {
              ...committedProfile,
              language: actualLocale || committedLanguage,
            },
            locale: {
              status: localeStatus,
              requested: language,
              actual: actualLocale,
            },
            message: localeStatus === 'rejected'
              ? 'Profile details were updated, but the language setting was rejected'
              : 'Profile details were updated, but the language setting could not be confirmed',
          }, 207)
        } catch (confirmationError) {
          if (!hasProfileFieldUpdates) {
            if (isDefiniteClientRejection(localeHttpStatus)) {
              return localeHttpStatus === 404
                ? errorResponse('NOT_FOUND', 'Zammad user not found', undefined, 404)
                : errorResponse(
                    'LOCALE_REJECTED',
                    'Zammad rejected the language update',
                    { upstreamStatus: localeHttpStatus },
                    502
                  )
            }

            logger.warning('UserProfile', 'Locale-only update outcome could not be confirmed', {
              data: {
                zammadId,
                requestedLocale: language,
                localeError: getErrorMessage(localeError),
                confirmationError: getErrorMessage(confirmationError),
              },
            })
            return outcomeUnconfirmedResponse('locale', {
              requestedLocale: language,
            })
          }

          if (isDefiniteClientRejection(localeHttpStatus)) {
            logger.warning('UserProfile', 'Profile fields updated but locale update was rejected', {
              data: {
                zammadId,
                requestedLocale: language,
                localeHttpStatus,
                localeError: getErrorMessage(localeError),
                confirmationError: getErrorMessage(confirmationError),
              },
            })

            return successResponse({
              outcome: 'partial',
              profileStatus,
              profile: committedProfile,
              locale: {
                status: 'rejected',
                requested: language,
                actual: null,
              },
              message: 'Profile details were updated, but the language setting was rejected',
            }, 207)
          }

          logger.warning('UserProfile', 'Profile fields updated but locale outcome could not be confirmed', {
            data: {
              zammadId,
              requestedLocale: language,
              localeError: getErrorMessage(localeError),
              confirmationError: getErrorMessage(confirmationError),
            },
          })

          return successResponse({
            outcome: 'partial',
            profileStatus,
            profile: committedProfile,
            locale: {
              status: 'unconfirmed',
              requested: language,
              actual: null,
            },
            message: 'Profile details were updated, but the language setting could not be confirmed',
          }, 207)
        }
      }
    }

    return successResponse({
      outcome: 'complete',
      profileStatus,
      profile: {
        ...committedProfile,
        language: language || committedLanguage,
      },
      message: 'Profile updated successfully',
    })
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return errorResponse('UNAUTHORIZED', 'Authentication required', undefined, 401)
    }
    logger.error('UserProfile', 'Failed to update profile', { data: { error: error instanceof Error ? error.message : error } })
    return serverErrorResponse('Failed to update profile')
  }
}
