# Rankora Architectural Decision Records (ADRs)

This document records the architectural and security decisions made for the Rankora platform role system, enforcement engine, administrative controls, and session infrastructure.

---

## D1: Separate `platformRole` Field Instead of Reusing Workspace Roles

- **Status**: Accepted
- **Context**: Rankora is a multi-tenant local SEO platform where users collaborate inside workspaces with tenant roles (`owner`, `admin`, `member`). The platform needed system-wide governance for SaaS administration, billing tier assignment, and security oversight across all workspaces.
- **Decision**: Introduce a dedicated `platformRole` enum on the `User` schema (`SUPER_ADMIN`, `ADMIN`, `USER`) in [`Backend/core-service/src/models/User.ts:68`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/models/User.ts#L68), completely orthogonal to `WorkspaceMember.role`.
- **Alternatives Considered**:
  - *Reusing workspace `admin`/`owner` roles*: Rejected because workspace owners must not possess permissions to edit global system plans, inspect unassociated tenants, or modify other users.
  - *Dynamic permission string arrays (`permissions: ['admin:read', ...]`)*: Rejected as overly complex for a 3-tier hierarchy and harder to query efficiently.
- **Consequences and Trade-offs**:
  - Clean boundary between multi-tenant business operations and platform SaaS administration.
  - Requires developers to distinguish between `req.user.platformRole` (platform access) and `req.membership.role` (tenant workspace access).

---

## D2: Unified Frontend & Unified Backend Architecture

- **Status**: Accepted
- **Context**: Administrative dashboards are often developed as disconnected secondary applications (e.g. an internal tool on a separate subdomain or port).
- **Decision**: Maintain a single Vite React frontend and single Express `core-service` backend, serving both consumer workflows and administrator management portals under `/admin`.
- **Alternatives Considered**:
  - *Separate admin SPA (e.g. `admin.rankora.com`)*: Rejected due to duplicate UI component libraries, duplicated Redux store configurations, and complex multi-domain CORS/cookie handling.
  - *Third-party admin generator (Forest Admin / Retool)*: Rejected because custom conditional quota increments and real-time plan calculation engines require deep coupling with domain models.
- **Consequences and Trade-offs**:
  - Zero deployment fragmentation; single Docker build for backend and single build for frontend.
  - Strict security burden on the backend: routes under `/api/admin` must never rely on frontend UI hiding and must enforce `requireRole(['ADMIN', 'SUPER_ADMIN'])`.

---

## D3: Single Unified Login Endpoint with Dedicated `/admin-login` Entrypoint

- **Status**: Accepted
- **Context**: Administrators and regular users share the same underlying credentials, but administrators need a dedicated bookmarkable portal (`/admin/login`) with distinct brute-force constraints.
- **Decision**: Keep the primary `POST /api/auth/login` capable of authenticating any role (with automatic client-side redirection to `/admin` for administrators), while providing a specialized `POST /api/auth/admin-login` endpoint in [`auth.service.ts:280`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/auth/auth.service.ts#L280) that strictly rejects any account with `platformRole === 'USER'`.
- **Alternatives Considered**:
  - *Allowing only one login endpoint*: Worked for authentication, but did not allow dedicated security controls or specialized audit logs (`ADMIN_LOGGED_IN` vs `USER_LOGGED_IN`).
  - *Completely distinct credentials database for admins*: Disallowed administrative users from testing and utilizing client platform features with a single identity.
- **Consequences and Trade-offs**:
  - Provides a dedicated URL for enterprise administrators while preventing ordinary users from attempting to sign in through the privileged endpoint.

---

## D4: Strict Role Isolation on Creation

- **Status**: Accepted
- **Context**: Mass registration endpoints must never allow privilege escalation attacks (e.g., passing `{"platformRole": "ADMIN"}` in client registration JSON payloads).
- **Decision**: Enforce role assignment strictly through three isolated channels:
  1. `POST /api/auth/register`: Hardcoded in [`auth.service.ts:83`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/auth/auth.service.ts#L83) to `platformRole: 'USER'`. Any client-supplied role is discarded.
  2. `POST /api/superadmin/admins`: Accessible exclusively to `SUPER_ADMIN`, generating temporary passwords and setting `mustChangePassword: true`.
  3. `seed:superadmin`: Seed CLI script ([`seed-superadmin.ts`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/scripts/seed-superadmin.ts)) requiring environment variables for initial bootstrapping.
- **Alternatives Considered**:
  - *Allowing role selection with an invitation code*: Rejected due to risk of brute force or token leakage.
- **Consequences and Trade-offs**:
  - Eliminates horizontal and vertical privilege escalation at registration.

---

## D5: Admin-Set Overrides Win Over Plan Defaults (`override ?? plan default`)

- **Status**: Accepted
- **Context**: Customers frequently request custom allocations (e.g. 5 extra locations or 200 extra scan credits) without migrating to a higher billing tier.
- **Decision**: Store `limitOverrides` on the `User` schema. When calculating effective limits in [`packages/shared/src/constants/plans.ts:209`](file:///c:/Users/uditp/Desktop/Rankora/packages/shared/src/constants/plans.ts#L209), apply:
  ```typescript
  limit = override !== null && override !== undefined ? override : planDefault;
  ```
  Passing `null` in the admin interface resets the override back to standard plan defaults.
- **Alternatives Considered**:
  - *Creating bespoke custom plan entities in the database for each customer*: Rejected as it leads to schema bloat and difficult reporting.
- **Consequences and Trade-offs**:
  - High flexibility for support/sales teams; easy reversion back to standard tier defaults at any time.

---

## D6: Centralized Plan Definitions in Shared Constants Package

- **Status**: Accepted
- **Context**: Plan features, default quotas, and prices must stay strictly synchronized between backend quota assertions and frontend marketing/account screens.
- **Decision**: Centralize all plan definitions (`PLAN_DEFAULTS`, `PlanDefinition`, `PlanLimits`, `PlanPermissions`) in [`packages/shared/src/constants/plans.ts`](file:///c:/Users/uditp/Desktop/Rankora/packages/shared/src/constants/plans.ts#L34), imported identically by both `@localo/core-service` and `@rankora/frontend`.
- **Alternatives Considered**:
  - *Storing plans in a MongoDB collection*: Rejected because schema modifications to plan features would require database migrations and caching layers, whereas static shared definitions compile into both builds with TypeScript type safety.
- **Consequences and Trade-offs**:
  - Zero divergence between frontend display and backend enforcement.
  - Changing a plan default requires a git commit and deployment, rather than an ad-hoc database update.

---

## D7: Server-Side Enforcement with Frontend UI Suppression as Convenience

- **Status**: Accepted
- **Context**: Frontend UI controls (such as disabling a button when credits reach 0) can easily be bypassed by direct API calls using Postman or curl.
- **Decision**: The backend `userLimitsService` ([`Backend/core-service/src/modules/admin/user-limits.service.ts`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/admin/user-limits.service.ts)) is the authoritative enforcer. Every scan, query, location creation, and PDF export validates permissions and limits server-side. Frontend components only read `useGetMyLimitsQuery` to display friendly UI states.
- **Alternatives Considered**:
  - *Client-side checking with trusted API requests*: Rejected as a critical security vulnerability.
- **Consequences and Trade-offs**:
  - Uncompromising API security. All direct API and MCP integrations respect the exact same administrative boundaries.

---

## D8: Atomic Conditional `$inc` for Usage Counters to Prevent Race Conditions

- **Status**: Accepted
- **Context**: Fast automated scripts or concurrent user requests can trigger multiple scans simultaneously, bypassing standard `read -> check -> write` limit checks.
- **Decision**: Implement MongoDB atomic conditional updates (`findOneAndUpdate`) in [`user-limits.service.ts:129`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/admin/user-limits.service.ts#L129):
  ```typescript
  const updated = await User.findOneAndUpdate(
    {
      _id: userId,
      'usage.keywordsScannedThisMonth': { $lte: limits.keywordScanLimit - count }
    },
    { $inc: { 'usage.keywordsScannedThisMonth': count } },
    { new: true }
  );
  if (!updated) throw new LimitExceededError();
  ```
- **Alternatives Considered**:
  - *Distributed Redis locks (`redlock`)*: Rejected as heavy, network-intensive, and prone to deadlocks during node restarts.
- **Consequences and Trade-offs**:
  - Concurrency-safe limit enforcement directly inside the database engine with zero external locking overhead.

---

## D9: Lazy Monthly Reset vs. Cron Job

- **Status**: Accepted
- **Context**: Usage counters must reset every 30 days. Running scheduled bulk midnight crons against thousands of users can cause database query spikes, connection timeouts, and clock skew issues.
- **Decision**: Implement lazy rollover inside [`user-limits.service.ts:30`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/admin/user-limits.service.ts#L30):
  ```typescript
  if (now.getTime() - resetAt.getTime() >= 30 * 24 * 60 * 60 * 1000) {
    user.usage.keywordsScannedThisMonth = 0;
    user.usage.scanCreditsUsed = 0;
    user.usage.chatbotUsed = 0;
    user.usage.usageResetAt = now;
    await user.save();
  }
  ```
- **Alternatives Considered**:
  - *Cron scheduler querying all users every midnight*: Rejected due to resource spikes and vulnerability to worker scheduler crashes.
- **Consequences and Trade-offs**:
  - Zero cron maintenance; active users are guaranteed a clean billing window on their first request after day 30.
  - Inactive users retain their old usage numbers in the database until they become active or an admin views their record.

---

## D10: Lazy Plan Expiry and `EXPIRED_PLAN_BEHAVIOR`

- **Status**: Accepted
- **Context**: Time-limited plans (like trials or promo grants) have an expiration timestamp (`planExpiresAt`). The system must handle expired users gracefully across all API calls.
- **Decision**: 
  1. Add `EXPIRED_PLAN_BEHAVIOR = 'FALLBACK_TO_TRIAL'` in [`packages/shared/src/constants/plans.ts:182`](file:///c:/Users/uditp/Desktop/Rankora/packages/shared/src/constants/plans.ts#L182).
  2. Implement an in-band check in `authenticate` ([`auth.middleware.ts:88`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/middleware/auth.middleware.ts#L88)) and `checkAndResetMonthlyUsage`: if `planExpiresAt < Date.now()`, the user is lazily updated to `Trial` in the database, resetting overrides and permissions.
- **Alternatives Considered**:
  - *Hard account lockout upon expiration*: Rejected as overly hostile to users whose subscriptions lapse.
- **Consequences and Trade-offs**:
  - Smooth user downgrade to free trial capabilities instead of total service outage.

---

## D11: Centralized Authentication Middleware for Status & Password Checks

- **Status**: Accepted
- **Context**: Security checks (suspension, mandatory password changes) were previously applied on individual controllers, risking developers forgetting guards on new endpoints.
- **Decision**: Consolidate `user.status === 'SUSPENDED'` and `user.mustChangePassword === true` checks directly into the global `authenticate` middleware ([`Backend/core-service/src/middleware/auth.middleware.ts:79-114`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/middleware/auth.middleware.ts#L79-L114)).
- **Alternatives Considered**:
  - *Separate standalone middlewares chained on every route*: Rejected because human error can omit a middleware on new route files.
- **Consequences and Trade-offs**:
  - 100% of authenticated routes (including keywords, chat, MCP, and competitor audits) automatically enforce account suspension and first-time password change policies without manual middleware chaining.

---

## D12: Narrow CSRF Exemption for Public Authentication Endpoints

- **Status**: Accepted
- **Context**: Double-Submit Cookie CSRF protection requires clients to provide an `x-csrf-token` header matching the `csrfToken` cookie. However, unauthenticated login and registration endpoints cannot supply a pre-existing token.
- **Decision**: In [`Backend/core-service/src/middleware/csrf.middleware.ts:16`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/middleware/csrf.middleware.ts#L16), limit the exemption strictly to `POST /api/auth/login`, `POST /api/auth/admin-login`, `POST /api/auth/register`, `POST /api/auth/refresh`, and `POST /api/auth/google`.
- **Alternatives Considered**:
  - *Exempting all `/api/auth/*` endpoints*: Rejected because sensitive authenticated operations like `POST /api/auth/change-password` and `POST /api/auth/logout` would be left vulnerable to cross-site request forgery.
- **Consequences and Trade-offs**:
  - All administrative mutations, platform configurations, and password changes remain strictly protected against CSRF attacks.

---

## D13: Instant Session Revocation via Versioned Epochs (`sessionVersion`)

- **Status**: Accepted
- **Context**: Standard stateless JWT tokens remain valid until their expiration (15 minutes), making immediate account suspension or administrative password resets ineffective until token TTL expires.
- **Decision**: Embed `sessionVersion` inside the JWT payload ([`token.service.ts:67`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/auth/token.service.ts#L67)). On every authenticated request, `authenticate` compares the token's `sessionVersion` against the active version stored in Redis (with MongoDB fallback). Calling `tokenService.incrementSessionVersion(userId)` immediately renders all existing access tokens and refresh tokens invalid across all devices.
- **Alternatives Considered**:
  - *Deny-listing individual JWT IDs (jti) in Redis*: Rejected due to high memory footprint and complex TTL management.
- **Consequences and Trade-offs**:
  - Instantaneous global session revocation upon suspension, deletion, or password change with a fast O(1) Redis check.

---

## D14: Soft Deletion of Administrators & Re-Registration Quarantine

- **Status**: Accepted
- **Context**: Deleting an administrator must prevent immediate token reuse, but also prevent an attacker from immediately re-registering the same email address as a regular user to access residual workspace resources.
- **Decision**:
  1. Deletion marks the record as `status = 'DELETED'` in [`superadmin.controller.ts:221`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/admin/superadmin.controller.ts#L221) and revokes all active session versions.
  2. The registration endpoint ([`auth.service.ts:61`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/auth/auth.service.ts#L61)) inspects existing accounts: if `status === 'DELETED'`, it halts with `ACCOUNT_DELETED_CONTACT_SUPPORT` (HTTP 403).
- **Alternatives Considered**:
  - *Hard `deleteOne` from MongoDB*: Rejected because audit logs would point to dangling foreign keys, and the email could be immediately claimed by a malicious actor.
- **Consequences and Trade-offs**:
  - Historical audit trails remain intact; deleted admin emails cannot be hijacked without manual administrator intervention.

---

## D15: Dual-Layer Rate Limiting (IP & Email) with Fail-Closed Security

- **Status**: Accepted
- **Context**: Distributed botnets rotate IP addresses to bypass standard IP rate limiting, while single-IP brute-force attempts target individual accounts.
- **Decision**:
  1. Chain two rate limiters on `/login` and `/admin-login` in [`auth.routes.ts:28-29`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/auth/auth.routes.ts#L28-L29):
     - `authRateLimiter`: 15 attempts / 15 mins per IP.
     - `emailAuthRateLimiter`: 10 attempts / 15 mins per target email across all IPs.
  2. In production, `failClosedIfRedisDown` returns HTTP 503 if Redis is unreachable to avoid silently bypassing rate limiters.
- **Alternatives Considered**:
  - *Account lockout by updating `User.isLocked` in MongoDB*: Rejected because attackers can intentionally lock out arbitrary victim accounts by sending false passwords (Denial of Service).
- **Consequences and Trade-offs**:
  - Thwarts both single-IP credential stuffing and distributed botnet attacks without locking legitimate users out permanently.

---

## D16: Immutable Audit Logging on Every Administrative Mutation

- **Status**: Accepted
- **Context**: SOC2 and platform compliance require tracking which administrator altered plan subscriptions, limits, or user access.
- **Decision**: Every mutation in `admin.controller.ts` and `superadmin.controller.ts` writes a record to `AuditLog` containing `actorUserId`, `actorRole`, `targetUserId`, `action`, IP address, User-Agent, and full `before` and `after` snapshots.
- **Alternatives Considered**:
  - *Storing an `updatedBy` field directly on the `User` document*: Rejected because it only records the most recent editor and discards previous state change history.
- **Consequences and Trade-offs**:
  - Complete, auditable historical timeline for compliance and security forensics.

---

## D17: Self-Management Restrictions & Last Super Administrator Protection

- **Status**: Accepted
- **Context**: A super administrator might accidentally delete or demote themselves, locking all administrators out of the system.
- **Decision**:
  1. `CANNOT_MANAGE_SELF`: Super admins cannot edit or delete their own administrator account via `/api/superadmin/admins/:id`.
  2. `LAST_SUPERADMIN_PROTECTED`: In [`superadmin.controller.ts:207`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/src/modules/admin/superadmin.controller.ts#L207), the system counts active super admins. If `<= 1`, deletion or demotion is rejected.
- **Alternatives Considered**:
  - *Relying on database backups for recovery*: Rejected as costly and causing production downtime.
- **Consequences and Trade-offs**:
  - Guarantees the system can never be rendered orphan or administrator-less.

---

## D18: Test Database Isolation & Production Execution Refusal

- **Status**: Accepted
- **Context**: Automated test suites executing against production databases can wipe live client data.
- **Decision**: In [`test-phase3-suite.ts`](file:///c:/Users/uditp/Desktop/Rankora/Backend/core-service/scripts/test-phase3-suite.ts#L15-L35):
  1. Resolves `MONGO_URI_TEST` (or derives `localseo_test`).
  2. Halts with code 1 if `NODE_ENV=production`.
  3. Halts with code 1 if the URI string contains `prod` or `production` without `test`.
  4. Automatically deletes all test users and test audit logs in its `finally` block.
- **Alternatives Considered**:
  - *Mocking Mongoose in-memory*: Rejected because MongoDB-specific operators (like conditional `$lte` in `$inc` and transactional rollbacks) must be verified against an actual engine.
- **Consequences and Trade-offs**:
  - High testing fidelity with zero risk of production database corruption.

---

## D19: Deferred Payment Processing Integration

- **Status**: Accepted
- **Context**: The platform required immediate administrative management of plans and limits before public payment processing (Stripe / Razorpay) was integrated.
- **Decision**: Exclude payment processing from the initial platform release. Subscriptions, limits, and upgrades are managed manually by administrators via the `/admin` portal. The existing `/settings/billing` and `/settings/plans` pages display current plan status and effective limits cleanly without initiating payment charges.
- **Alternatives Considered**:
  - *Rushing a partial Stripe integration*: Rejected to prevent billing race conditions and complex refund handling before platform role stability was finalized.
- **Consequences and Trade-offs**:
  - Keeps the core system lightweight and reliable while establishing the complete enforcement and limit infrastructure.

---

## Open Questions & Deferred Work

1. **Self-Service Billing**: Integrating Stripe/Razorpay webhooks to automatically trigger `adminController.updatePlan` upon successful payment events.
2. **Mandatory 2FA for Administrators**: Currently MFA is optional via TOTP (`/api/auth/mfa/*`). Future iterations may enforce `mfaEnabled: true` for all accounts with `platformRole === 'ADMIN' || 'SUPER_ADMIN'`.
3. **Usage Alert Notifications**: Proactive email notifications via Resend when a user reaches 80% and 100% of their monthly keyword scan quota or AI copilot quota.
4. **Sub-Admin Permission Scopes**: Partitioning the `ADMIN` role into more granular permission sets (e.g., Support Admin who can reset usage vs. Billing Admin who can change plans).

---

## Known Gaps

1. **Lazy Counter Rollover Timing**: Because monthly counter resets and plan expirations occur lazily upon request execution, an account that remains dormant for 60 days will retain stale usage counters in the database until they make an API request or an administrator inspects their profile.
2. **Session Revocation Redis Dependency**: While `tokenService.incrementSessionVersion` writes to both MongoDB and Redis, high-frequency token checks in `authenticate` rely on Redis for low-latency cache validation. If Redis is down in a development environment, it falls back to MongoDB, increasing database read load.
