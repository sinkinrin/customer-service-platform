## ADDED Requirements

### Requirement: Server validates session before issuing identity
#### Scenario: Missing session
- **WHEN** a request hits any protected API without a server-validated session token
- **THEN** the API responds with 401 and no mock or default user is issued.

#### Scenario: Tampered auth-session cookie
- **WHEN** the client sends an `auth-session` cookie whose contents are altered (e.g., forged role or user id)
- **THEN** the server rejects the cookie, does not grant an identity, and returns 401.

### Requirement: Privileged APIs enforce server-side roles
#### Scenario: Admin/staff-only operations
- **WHEN** a caller is not an authenticated admin or staff as verified on the server
- **THEN** admin/staff endpoints (ticket CRUD, FAQ CRUD, staff conversation access) respond with 403 and perform no side effects.
