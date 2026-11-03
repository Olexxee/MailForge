# API Contracts

Base path /api/v1; HTTPS JSON; validate params/query/body. Every mailbox operation enforces server-side access. Thin controllers and service-owned business logic.

Success envelope: { success: true, data: ... }
Error envelope: { success: false, error: { code, message, details: [] } }
Never expose stack traces, provider credentials, protocol traces, or sensitive provider responses.

## Endpoint inventory (planning only)
Auth: login/logout/refresh/me. Staff: invitations, invitation acceptance, members list/update/deactivate. Domains: list/create/update. Providers: list/create/validate/update/deactivate. Mailboxes: list/create/read/update and access grant/revoke. Mail: folders, message list/detail, send, reply, forward, supported flags, move, sync.

Define request/response schemas, status codes, provider capability requirements, pagination, idempotency, rate limits, and errors before implementing each endpoint.

## Permissions
List/read: READ. Send/reply/forward: SEND. Move/archive/trash/restore: MANAGE. Grant access: ADMINISTER plus organisation role policy. Domain/provider/mailbox configuration: OWNER or ADMIN.

Services must verify active user, organisation membership, resource ownership, mailbox permission, and active provider/mailbox. Use bounded provider-aware pagination. Provider acceptance is not proof of delivery. Avoid automatic send retries after uncertain outcomes.

## Phase 1 authentication and organisation endpoints

- `POST /api/v1/auth/login`: validates email/password, creates a server-side session, sets an HttpOnly session cookie and a separate CSRF cookie, and returns the CSRF token in the response data.
- `POST /api/v1/auth/logout`: requires a valid session and CSRF token; revokes the current session and clears cookies.
- `POST /api/v1/auth/refresh`: requires a valid session and CSRF token; atomically revokes the old session and issues a new one. Sessions have a seven-day idle expiry and a 30-day absolute lifetime.
- `GET /api/v1/auth/me`: returns the active user and active organisation memberships.
- `GET /api/v1/organisations`: lists the authenticated user's active organisation memberships.
- `GET /api/v1/organisations/:organisationId/members`: OWNER/ADMIN only.
- `PATCH /api/v1/organisations/:organisationId/members/:userId`: OWNER/ADMIN controlled role or activation update. OWNER memberships are protected; ADMIN can manage STAFF only.
- `POST /api/v1/organisations/:organisationId/invitations`: OWNER/ADMIN only. ADMIN may invite STAFF only. Returns a single-use invitation token once for secure manual distribution; it is never persisted in plaintext.
- `POST /api/v1/invitations/accept`: accepts an invitation and creates a new account with a password of at least 12 characters.
- `POST /api/v1/invitations/accept-existing`: accepts an invitation for an already authenticated account whose email matches the invitation.
- `POST /api/v1/organisations/:organisationId/invitations/:invitationId/revoke`: OWNER/ADMIN only; revokes a pending invitation.

All state-changing authenticated endpoints require the CSRF cookie and matching `x-csrf-token` header. Browser-origin requests must match configured `WEB_ORIGIN`. Owner bootstrap is a CLI operation, not an HTTP endpoint. Invitation email delivery is not yet connected; administrators must distribute the one-time token through an approved secure channel.

- `GET /api/v1/auth/csrf`: authenticated, no-store endpoint that rotates and returns a fresh CSRF token for the current session. The web client calls this on startup because the CSRF cookie is host-only to the API origin.
- `GET /api/v1/organisations/:organisationId/invitations`: OWNER/ADMIN only; lists pending, unexpired invitations without exposing token hashes.


## Phase 2 domains, provider connections, and mailbox access

- `GET /api/v1/organisations/:organisationId/domains`: active organisation members may list domain records.
- `POST /api/v1/organisations/:organisationId/domains`: OWNER/ADMIN only. Adds a PENDING domain and returns a one-time DNS TXT challenge at `_mailforge-verification.<domain>`. This does not change DNS or prove ownership.
- `POST /api/v1/organisations/:organisationId/domains/:domainId/verify`: OWNER/ADMIN only. Resolves the TXT challenge and marks the domain VERIFIED only on an exact match.
- `POST /api/v1/organisations/:organisationId/domains/:domainId/verification-challenge`: OWNER/ADMIN only. Rotates a PENDING domain's TXT challenge if the one-time value was lost; verified domains cannot be rotated.
- `GET /api/v1/organisations/:organisationId/mailboxes`: returns only ACTIVE mailboxes for which the current user has an active explicit grant.
- `POST /api/v1/organisations/:organisationId/mailboxes`: OWNER/ADMIN only. Creates a GO54 provider connection and mailbox after the selected domain is verified and the mailbox address matches that domain. Provider credentials are encrypted before persistence. The creator receives ADMINISTER access. This endpoint does not test network connectivity.
- `POST /api/v1/organisations/:organisationId/provider-connections/:connectionId/validate`: requires ADMINISTER mailbox access and separately checks IMAP authentication/folder listing and SMTP TLS/authentication using SMTP verify. It never sends a message.
- `GET /api/v1/organisations/:organisationId/mailboxes/:mailboxId/access`: requires ADMINISTER.
- `POST /api/v1/organisations/:organisationId/mailboxes/:mailboxId/access`: requires ADMINISTER and an active organisation membership for the target user.
- `DELETE /api/v1/organisations/:organisationId/mailboxes/:mailboxId/access/:userId`: requires ADMINISTER. The last active mailbox administrator cannot be removed. Deactivating an organisation membership revokes all of that user's mailbox grants; it is blocked if that user is the last active ADMINISTER grant on any mailbox. Re-activating the membership does not restore revoked grants.

Mailbox permissions are hierarchical: READ (read only), SEND (read/send), MANAGE (read/send/organise), ADMINISTER (all mailbox permissions and access administration). Organisation roles never imply mailbox access. A user must have both an active organisation membership and an active mailbox grant.

Domain/provider/mailbox configuration never modifies registrar DNS or the external provider account. Provider validation returns protocol status and safe error codes only; it never returns credentials or raw protocol diagnostics.
