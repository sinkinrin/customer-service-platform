Findings
Production sign-in path will throw AUTH_CONFIG_MISSING when mock auth is disabled but AUTH_DEFAULT_USER_EMAIL/PASSWORD aren’t set, because env validation never enforces those variables yet validateCredentials throws instead of returning a clear 401/redirect. This can break all production logins if mock auth is off without a fallback provider.

建议的任务
Harden production auth fallback when mock auth is disabled

启动任务
/api/faq assumes translation.keywords is always valid JSON; any malformed value will cause JSON.parse to throw, returning a 500 on a public endpoint. Both the search filter and response mapping parse without guards, so a single bad row can take the API down.

建议的任务
Make FAQ keywords parsing resilient to malformed data

Review: feat: ticket assignment, vacation, and admin management enhancements ## Summary - New admin features for ticket auto-assignment, staff vacation handling, and user management (import/export/status) landed on master. - Added Zammad client wrappers and admin dashboard visualizations for assignment and performance insights. ## Findings 1. **User list/export may silently drop users when more than the Zammad API default page size** - Both the admin user list (GET /api/admin/users) and export endpoints call searchUsers('*') without any pagination or loop over pages. Zammad's /users/search endpoint defaults to returning only the first page (50 records by default), so the UI pagination and the CSV export will never include users beyond that limit. Large tenant user bases will see incomplete data and incorrect total counts. - Suggested fix: iterate over /users/search with limit/offset until no more results (or expose query params to Zammad to request a larger limit) before applying local pagination/export.