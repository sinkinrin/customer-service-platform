import { type NextRequest } from 'next/server'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/utils/auth'
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse, serverErrorResponse } from '@/lib/utils/api-response'

// Helper for bad request
const badRequestResponse = (message: string) => errorResponse('BAD_REQUEST', message, undefined, 400)

const UpdateUserRoleSchema = z.object({
  role: z.enum(['customer', 'staff', 'admin'])
})

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}))
    const parsed = UpdateUserRoleSchema.safeParse(body)
    if (!parsed.success) {
      return badRequestResponse('Invalid body: role must be one of customer|staff|admin')
    }

    const currentUser = await getCurrentUser()
    if (!currentUser) {
      return unauthorizedResponse()
    }

    // Verify current user is admin
    const supabase = await createClient()
    const { data: myProfile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', currentUser.id)
      .single()

    if (myProfile?.role !== 'admin') {
      return forbiddenResponse()
    }

    const targetUserId = params.id
    const nextRole = parsed.data.role

    // Prefer admin client to bypass RLS safely for cross-user update
    let admin
    try {
      admin = createAdminClient()
    } catch {
      admin = null
    }

    const client = admin ?? (await createClient())

    const { data: updated, error } = await client
      .from('user_profiles')
      .update({ role: nextRole })
      .eq('user_id', targetUserId)
      .select('user_id, role, full_name, updated_at')
      .single()

    if (error) {
      return serverErrorResponse('Failed to update role', error.message)
    }

    return successResponse(updated)
  } catch (e: any) {
    return serverErrorResponse('Unexpected error', e?.message)
  }
}

