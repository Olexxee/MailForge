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