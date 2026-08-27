export interface AuthorizationIdentity {
  id: string
  email: string
  role: string
  zammad_id?: number
  region?: string
  group_ids?: number[]
}

/**
 * Stable key for client-side request lifecycles that depend on the complete
 * authorization context, not only the local user id.
 */
export function getAuthorizationIdentityKey(
  user?: AuthorizationIdentity | null
): string | null {
  if (!user) return null

  return JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    zammadId: user.zammad_id ?? null,
    region: user.region ?? null,
    groupIds: [...(user.group_ids ?? [])].sort((a, b) => a - b),
  })
}
