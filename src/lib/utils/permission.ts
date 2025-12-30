/**
 * 统一权限工具
 * 所有工单相关 API 必须使用该模块进行权限检查
 */

export interface AuthUser {
  id: string
  email: string
  role: 'admin' | 'staff' | 'customer'
  zammad_id?: number
  group_ids?: number[]
  region?: string
}

export interface Ticket {
  id: number
  number?: string
  title?: string
  customer_id?: number
  owner_id?: number | null
  group_id?: number | null
  state_id?: number
  state?: string
}

// Type guard to check if an object has ticket properties
export function isTicketLike(obj: unknown): obj is Ticket {
  return typeof obj === 'object' && obj !== null && 'id' in obj
}

export type TicketAction = 'view' | 'edit' | 'delete' | 'close' | 'assign'

export interface PermissionContext {
  user: AuthUser
  ticket?: Ticket
  action: TicketAction
}

export interface PermissionResult {
  allowed: boolean
  reason?: string
}

/**
 * 检查用户对单个工单的权限
 */
export function checkTicketPermission(ctx: PermissionContext): PermissionResult {
  const { user, ticket, action } = ctx
  const userZammadId = user.zammad_id

  // Admin has full access
  if (user.role === 'admin') {
    return { allowed: true }
  }

  if (!ticket) {
    return { allowed: false, reason: 'No ticket provided' }
  }

  // Customer permissions
  if (user.role === 'customer') {
    // Customer can only access their own tickets
    if (ticket.customer_id !== userZammadId) {
      return { 
        allowed: false, 
        reason: `Customer ${userZammadId} cannot access ticket owned by customer ${ticket.customer_id}` 
      }
    }

    // Customer can view and close their own tickets
    if (action === 'view' || action === 'close') {
      return { allowed: true }
    }

    // Customer cannot delete, edit, or assign tickets
    return { 
      allowed: false, 
      reason: `Customer cannot perform action: ${action}` 
    }
  }

  // Staff permissions
  if (user.role === 'staff') {
    const userGroupIds = user.group_ids || []
    
    // Check if ticket is assigned to this staff
    const isAssignedToMe = ticket.owner_id === userZammadId
    
    // Check if ticket is in staff's region (group)
    const isInMyRegion = ticket.group_id != null && userGroupIds.includes(ticket.group_id)
    
    // Check if ticket is unassigned (no owner and no group)
    const isUnassigned = ticket.owner_id == null && ticket.group_id == null

    // Staff cannot see unassigned tickets
    if (isUnassigned) {
      return { 
        allowed: false, 
        reason: 'Staff cannot access unassigned tickets' 
      }
    }

    // Staff can access if assigned to them or in their region
    if (isAssignedToMe || isInMyRegion) {
      // Staff can view and edit their tickets
      if (action === 'view' || action === 'edit' || action === 'close') {
        return { allowed: true }
      }
      
      // Staff cannot delete tickets
      if (action === 'delete') {
        return { 
          allowed: false, 
          reason: 'Only admin can delete tickets' 
        }
      }

      // Staff can assign within their region
      if (action === 'assign') {
        return { allowed: true }
      }
    }

    return { 
      allowed: false, 
      reason: `Staff ${userZammadId} cannot access ticket (owner: ${ticket.owner_id}, group: ${ticket.group_id})` 
    }
  }

  // Unknown role
  return { 
    allowed: false, 
    reason: `Unknown role: ${user.role}` 
  }
}

/**
 * 过滤工单列表，只返回用户有权限查看的工单
 */
export function filterTicketsByPermission(
  tickets: Ticket[],
  user: AuthUser
): Ticket[] {
  const userZammadId = user.zammad_id

  // Admin sees all tickets
  if (user.role === 'admin') {
    console.log(`[Permission] Admin ${user.email} sees all ${tickets.length} tickets`)
    return tickets
  }

  // Customer only sees their own tickets
  if (user.role === 'customer') {
    const filtered = tickets.filter(t => t.customer_id === userZammadId)
    console.log(`[Permission] Customer ${user.email} (zammad_id: ${userZammadId}) sees ${filtered.length}/${tickets.length} tickets`)
    return filtered
  }

  // Staff sees assigned and regional tickets
  if (user.role === 'staff') {
    const userGroupIds = user.group_ids || []
    
    const filtered = tickets.filter(t => {
      // Assigned to me
      if (t.owner_id === userZammadId) {
        return true
      }
      
      // In my region (has group_id and matches my groups)
      if (t.group_id != null && userGroupIds.includes(t.group_id)) {
        return true
      }
      
      // Unassigned tickets are NOT visible to staff
      // (owner_id is null AND group_id is null)
      return false
    })
    
    console.log(`[Permission] Staff ${user.email} (zammad_id: ${userZammadId}, groups: [${userGroupIds.join(',')}]) sees ${filtered.length}/${tickets.length} tickets`)
    return filtered
  }

  // Unknown role sees nothing
  console.warn(`[Permission] Unknown role ${user.role} for user ${user.email}, returning empty list`)
  return []
}

/**
 * 检查用户是否可以删除工单
 */
export function canDeleteTicket(user: AuthUser): boolean {
  return user.role === 'admin'
}

/**
 * 检查用户是否可以关闭工单
 */
export function canCloseTicket(user: AuthUser, ticket: Ticket): boolean {
  const result = checkTicketPermission({ user, ticket, action: 'close' })
  return result.allowed
}

/**
 * 检查用户是否可以分配工单
 */
export function canAssignTicket(user: AuthUser): boolean {
  return user.role === 'admin' || user.role === 'staff'
}
