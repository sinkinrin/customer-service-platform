# Authentication System

> NextAuth.js v5 with Zammad Integration

**中文概览**: See [AUTHENTICATION.zh-CN.md](./AUTHENTICATION.zh-CN.md)

**Last Updated**: 2026-01-21
**NextAuth Version**: 5.0.0-beta.30

---

## Overview

The platform uses NextAuth.js v5 for authentication with a multi-strategy approach:

1. **Primary**: Zammad authentication (when `ZAMMAD_URL` + `ZAMMAD_API_TOKEN` are configured)
2. **Fallback**: Mock authentication (enabled by default in development, optional in production)
3. **Fallback**: Production env credential (single controlled user login path)

### Key Features

- JWT-based sessions (stateless, no database sessions)
- Role-based access control (customer, staff, admin)
- Region-based permissions
- 7-day session TTL
- Reverse-proxy friendly cookie settings (`useSecureCookies=false`)

---

## Configuration

Location: `src/auth.ts`

### Environment Variables

```env
# Required (production)
AUTH_SECRET=<32+ character secret for JWT signing>

# Optional (Zammad auth)
ZAMMAD_URL=http://your-zammad-server:8080/
ZAMMAD_API_TOKEN=<admin token>

# Optional (production fallback user; used when mock auth is disabled)
AUTH_DEFAULT_USER_EMAIL=user@example.com
AUTH_DEFAULT_USER_PASSWORD=strong-password
AUTH_DEFAULT_USER_ROLE=staff
AUTH_DEFAULT_USER_NAME="Authenticated User"
AUTH_DEFAULT_USER_REGION=asia-pacific

# Optional (mock auth)
# - Development: always enabled when NODE_ENV !== "production"
# - Production: disabled by default, can be explicitly enabled:
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Login Request                            │
│                    (email + password)                            │
└────────────────────────────┬────────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│                Strategy 1: Zammad Authentication                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 1. Call zammadClient.authenticateUser(email, password)  │   │
│  │ 2. Validate credentials via Zammad's /users/me          │   │
│  │ 3. Extract role from role_ids                           │   │
│  │ 4. Extract region from group_ids (staff) or note (customer)│
│  │ 5. Return user object with zammad_id                    │   │
│  └─────────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────────┘
                             │
                   Success?  │
              ┌──────────────┴──────────────┐
              │ Yes                         │ No
              ▼                             ▼
┌─────────────────────┐     ┌─────────────────────────────────────┐
│   Create Session    │     │    Strategy 2: Mock Authentication   │
│   (JWT Token)       │     │ (dev default; optional in production)│
└─────────────────────┘     │  ┌─────────────────────────────────┐│
                            │  │ 1. Check mockUsers[email]       ││
                            │  │ 2. Validate against mockPasswords││
                            │  │ 3. Return mock user object      ││
                            │  └─────────────────────────────────┘│
                            └─────────────────────────────────────┘

                           (when mock auth is disabled)
                             ┌─────────────────────────────────────┐
                             │ Strategy 3: Env User Credentials     │
                             │  - Validate email/password from env  │
                             │  - Role/region derived from env vars │
                             └─────────────────────────────────────┘
```

---

## Session Structure

### JWT Token Contents

```typescript
interface JWTToken {
  id: string           // User ID (e.g., "zammad-15")
  email: string        // User email
  role: string         // "customer" | "staff" | "admin"
  full_name: string    // Display name
  avatar_url?: string  // Profile image URL
  phone?: string       // Phone number
  language?: string    // Preferred language (en, zh-CN, etc.)
  region?: string      // User region (asia-pacific, etc.)
  zammad_id?: number   // Zammad user ID
  group_ids?: number[] // Zammad group IDs (for staff)
}
```

### Session Object

```typescript
interface Session {
  user: {
    id: string
    email: string
    role: "customer" | "staff" | "admin"
    full_name: string
    avatar_url?: string
    phone?: string
    language?: string
    region?: string
    zammad_id?: number
    group_ids?: number[]
  }
  expires: string  // ISO date string
}
```

---

## Role System

### Role Definitions

| Role | Description | Zammad role_ids |
|------|-------------|-----------------|
| **customer** | End users who create tickets | [3] (Customer) |
| **staff** | Support agents who handle tickets | [2] (Agent) |
| **admin** | Full system access | [1] (Admin) |

### Role Detection from Zammad

```typescript
function getRoleFromZammad(roleIds: number[]): 'admin' | 'staff' | 'customer' {
  if (roleIds.includes(1)) return 'admin'   // ZAMMAD_ROLES.ADMIN
  if (roleIds.includes(2)) return 'staff'   // ZAMMAD_ROLES.AGENT
  return 'customer'
}
```

---

## Region System

### Region Extraction

**For Staff/Admin**: Extracted from Zammad `group_ids`

```typescript
function getRegionFromGroupIds(groupIds?: Record<string, string[]>): string | undefined {
  if (!groupIds) return undefined
  for (const [groupId, permissions] of Object.entries(groupIds)) {
    if (permissions.includes('full')) {
      return getRegionByGroupId(parseInt(groupId))
    }
  }
  return undefined
}
```

**For Customers**: Extracted from Zammad `note` field

```typescript
function getRegionFromNote(note?: string): string | undefined {
  if (!note) return undefined
  const match = note.match(/Region:\s*(\S+)/)
  return match?.[1]
}
```

---

## Middleware Protection

Location: `middleware.ts`

### Route Protection Matrix

| Route Pattern | Required Role | Behavior |
|---------------|---------------|----------|
| `/admin/*` | admin | 403 for non-admin |
| `/staff/*` | staff, admin | 403 for customer |
| `/customer/*` | any authenticated | 401 for unauthenticated |
| `/api/admin/*` | admin | JSON 403 |
| `/api/*` | any authenticated | JSON 401 |
| `/auth/*` | none | Public |
| `/` | none | Public |

### Middleware Implementation

```typescript
export default auth((req) => {
  const { pathname } = req.nextUrl
  const session = req.auth

  // Public routes - always allow
  if (isRouteMatch(pathname, PUBLIC_ROUTES)) {
    return NextResponse.next()
  }

  // Check authentication
  const isLoggedIn = !!session?.user
  if (!isLoggedIn) {
    // API: return 401
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
    // Page: redirect to login
    return NextResponse.redirect(new URL("/auth/login", req.url))
  }

  // Role-based access
  const userRole = session.user.role

  if (pathname.startsWith("/admin") && userRole !== "admin") {
    return NextResponse.redirect(new URL("/unauthorized", req.url))
  }

  if (pathname.startsWith("/staff") && !["staff", "admin"].includes(userRole)) {
    return NextResponse.redirect(new URL("/unauthorized", req.url))
  }

  return NextResponse.next()
})
```

---

## Auth Utilities

Location: `src/lib/utils/auth.ts`

### requireAuth

Require any authenticated user.

```typescript
import { requireAuth } from '@/lib/utils/auth'

export async function GET() {
  const user = await requireAuth()
  // user is guaranteed to exist
  return successResponse({ user })
}
```

### requireRole

Require specific role(s).

```typescript
import { requireRole } from '@/lib/utils/auth'

export async function POST() {
  // Throws if user is not admin
  await requireRole(['admin'])

  // Or allow multiple roles
  await requireRole(['admin', 'staff'])
}
```

---

## Mock Authentication

Location: `src/lib/mock-auth.ts`

### When Active

Mock auth is enabled:
- In development: always, when `NODE_ENV !== "production"`
- In production: only when explicitly enabled via:
```typescript
NEXT_PUBLIC_ENABLE_MOCK_AUTH=true
```

### Test Accounts

| Email | Password | Role | Region |
|-------|----------|------|--------|
| `customer@test.com` | password123 | customer | asia-pacific |
| `staff@test.com` | password123 | staff | asia-pacific |
| `admin@test.com` | password123 | admin | (all regions) |

### Regional Test Users

| Email | Role | Region |
|-------|------|--------|
| `staff-ap-1@test.com` | staff | asia-pacific |
| `staff-me-1@test.com` | staff | middle-east |
| `staff-af-1@test.com` | staff | africa |
| `customer-ap-1@test.com` | customer | asia-pacific |
| ... | ... | ... |

---

## Frontend Integration

### Session Provider

Location: `src/components/providers/session-provider.tsx`

```tsx
import { SessionProvider as NextAuthSessionProvider } from "next-auth/react"

export function SessionProvider({ children, session }) {
  return (
    <NextAuthSessionProvider
      session={session}
      refetchOnWindowFocus={false}
    >
      <AuthStoreSync>{children}</AuthStoreSync>
    </NextAuthSessionProvider>
  )
}
```

### useAuth Hook

Location: `src/lib/hooks/use-auth.ts`

```typescript
import { useAuth } from '@/lib/hooks/use-auth'

function MyComponent() {
  const { user, userRole, isLoading, signOut } = useAuth()

  if (isLoading) return <Loading />
  if (!user) return <LoginPrompt />

  return <Dashboard user={user} />
}
```

### Protected Route Component

Location: `src/components/auth/protected-route.tsx`

```tsx
import { ProtectedRoute } from '@/components/auth/protected-route'

export default function StaffPage({ children }) {
  return (
    <ProtectedRoute requiredRoles={['staff', 'admin']}>
      {children}
    </ProtectedRoute>
  )
}
```

---

## Zustand Auth Store

Location: `src/lib/stores/auth-store.ts`

### State

```typescript
interface AuthState {
  user: MockUser | null
  session: MockSession | null
  userRole: 'customer' | 'staff' | 'admin' | null
  isLoading: boolean
  isInitialized: boolean
}
```

### Synchronization

The `AuthStoreSync` component keeps Zustand store in sync with NextAuth session:

```typescript
function AuthStoreSync({ children }) {
  const { data: session, status } = useNextAuthSession()
  const { setUser, setSession, setUserRole } = useAuthStore()

  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      setUser(session.user)
      setSession(session)
      setUserRole(session.user.role)
    }
  }, [session, status])

  return <>{children}</>
}
```

---

## Security Configuration

### Cookie Settings

```typescript
const authConfig: NextAuthConfig = {
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60,  // 7 days
  },
  trustHost: true,
  useSecureCookies: false,  // Set true for HTTPS
}
```

### Pages

```typescript
pages: {
  signIn: "/auth/login",
  error: "/auth/error",
}
```

---

## API Routes

### NextAuth Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/auth/callback/credentials` | Login |
| `GET /api/auth/session` | Get current session |
| `POST /api/auth/signout` | Logout |
| `GET /api/auth/csrf` | Get CSRF token |

### Custom Auth Endpoints

| Endpoint | Purpose |
|----------|---------|
| `PUT /api/user/password` | Change password |
| `GET /api/user/profile` | Get profile |
| `PUT /api/user/profile` | Update profile |

---

## Troubleshooting

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "AUTH_CONFIG_MISSING" | No auth method configured | Set Zammad or mock auth env vars |
| Session not persisting | Cookie issues | Check AUTH_SECRET is set |
| Role not detected | Zammad role_ids missing | Verify user has roles in Zammad |
| Region not detected | Missing group_ids/note | Check Zammad user configuration |

### Debug Mode

Enable debug logging in development:

```typescript
debug: process.env.NODE_ENV === "development"
```

Check console for `[Auth]` prefixed logs.

---

## Related Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) - System overview
- [ZAMMAD-INTEGRATION.md](./ZAMMAD-INTEGRATION.md) - Zammad auth details
- [NextAuth.js Docs](https://authjs.dev/) - Official documentation
