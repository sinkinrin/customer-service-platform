/**
 * Unauthorized Page
 *
 * Displayed when a user tries to access a route they don't have permission for.
 * Uses the auth.accessDenied i18n translations.
 */

import { auth } from "@/auth"
import { UnauthorizedContent } from "./unauthorized-content"

export default async function UnauthorizedPage() {
  const session = await auth()
  const userRole = session?.user?.role || null

  return <UnauthorizedContent userRole={userRole} />
}
