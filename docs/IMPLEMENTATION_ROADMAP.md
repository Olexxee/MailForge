# Implementation Roadmap

Phases are sequential. Do not start a later phase until the current phase's exit criteria are met and reviewed. Every phase includes tests, CI, documentation updates, security review, and user review.

## Phase 0 — Engineering foundation and architecture

Build the platform skeleton before product features.

- Create npm-workspaces monorepo with `apps/web`, `apps/api`, `apps/worker` and shared packages for database, shared contracts, provider-core, GO54 adapter, and config.
- Configure Node.js 22, ESM, TypeScript strictness, linting, formatting, and workspace scripts.
- Establish Express app/server separation, graceful startup/shutdown, environment validation, request IDs, structured redacted logging, security headers, CORS, body limits, and rate-limit integration points.
- Implement typed application errors, error codes, `asyncWrapper`, not-found middleware, final central error middleware, shared success/error response helpers, and request validation conventions.
- Add health/readiness endpoints.
- Configure PostgreSQL/Prisma and a reproducible migration workflow.
- Define provider-core interfaces and capability flags; add a fake provider for deterministic contract tests.
- Configure CI for clean install, lint, typecheck, tests, and builds.
- Add a complete placeholder-only `.env.example` and local development instructions.

**Exit criteria:** clean checkout installs and builds; CI lint/typecheck/tests pass; async rejection, 404, typed errors, safe production errors, and validation are tested; Prisma schema/migrations are reproducible; fake provider contract tests pass; no secrets are committed. No real provider credentials or real email sends are required.


### Required backend module structure

Every HTTP business feature uses a feature-based directory with exactly these responsibility layers and singular filename suffixes:

```text
modules/<feature>/
├── <feature>.db.ts
├── <feature>.service.ts
├── <feature>.controller.ts
├── <feature>.route.ts
└── <feature>.validator.ts
```

- `db`: Prisma persistence and transaction boundaries only.
- `service`: business rules and orchestration; no Express request/response objects.
- `controller`: thin HTTP mapping; no direct database queries or business rules.
- `route`: endpoint registration and middleware composition; use the singular `.route.ts` suffix.
- `validator`: schemas and parsing for params, query, and body.

Keep all five files together inside each feature directory. Do not create global `controllers/`, `services/`, or `repositories/` directories for feature code. Do not add empty layers to infrastructure-only modules that do not expose HTTP endpoints; document any justified exception.

## Phase 1 — Authentication and organisation access

- One-time owner bootstrap through a CLI command, protected by a PostgreSQL transaction advisory lock; no public owner-registration endpoint.
- Login, logout, current-user endpoint, CSRF-protected cookie sessions, atomic session rotation, revocation, seven-day idle expiry, and 30-day absolute expiry.
- Organisation membership listing and controlled role/deactivation operations. Owner membership cannot be modified through the staff-management endpoint.
- Staff/admin invitations with hashed, expiring, single-use tokens, revocation, and acceptance for new and existing accounts.
- Until transactional email delivery is integrated, invitation tokens are returned once to an authorised administrator for secure manual distribution.
- Audit events for owner bootstrap, invitations, invitation acceptance/revocation, and membership changes.
- No public signup; new accounts can only be created by accepting a valid invitation.

**Exit criteria:** bootstrap is one-time and concurrency-safe; owner invites staff; invited new and existing users can accept; revoked/expired/replayed invitations fail; login/logout/refresh and session revocation work; CSRF and origin checks reject forged requests; organisation isolation and role-escalation tests pass; no public signup.

## Phase 2 — Domains, provider connections, and mailboxes

- Organisation-owned domain, provider connection, and mailbox records.
- Encrypted provider credentials with key-version metadata.
- GO54 adapter configuration and separate IMAP/SMTP connectivity and authentication checks.
- Mailbox registration, explicit user-to-mailbox grants, and provider health/capability reporting.

**Exit criteria:** IMAP and SMTP are independently validated; organisation and mailbox permissions are enforced; encryption/redaction tests pass; validation sends no real email. Confirm GO54 account-level IMAP/SMTP availability.

## Phase 3 — Inbox, folders, and reading

- Provider-backed folders and capability-aware mapping.
- Bounded stable pagination, message detail, safe HTML sanitisation.
- Read/unread state where supported.
- Authorised, bounded attachment streaming.
- Sync checkpoints with correct IMAP UIDVALIDITY handling where needed.

**Exit criteria:** authorised users can list/read; cross-mailbox access is denied; content/attachments are bounded; unsafe HTML is neutralised; provider errors are safely mapped.

## Phase 4 — Compose, reply, forward, and send

- Compose/reply/forward with validated recipients/content.
- Attachment type/size limits.
- GO54 SMTP send and separate Sent-folder placement handling.
- Idempotency/duplicate-send protection and uncertain-outcome handling.

**Exit criteria:** authorised end-to-end send/reply works; SMTP acceptance is distinguished from delivery; sent placement is verified; uncertain sends are never blindly retried. Real email tests require explicit approval.

## Phase 5 — Mailbox productivity

- Provider-aware search.
- Flags, move, archive, trash, restore, and delete only when supported.
- Drafts, signatures, and preferences where supported.
- Observable, bounded sync scheduling/retries.
- Responsive and accessibility refinements.

**Exit criteria:** provider-specific capability behaviour is tested; destructive actions are confirmed/audited; unsupported operations are never reported as successful.

## Phase 6 — Additional provider adapters

- Review Google Workspace OAuth scopes, consent, refresh/revocation, and Gmail API semantics.
- Add Google adapter behind provider-core.
- Consider Microsoft 365/Graph after separate auth/capability review.
- Add adapter contract and provider-specific integration tests.

**Exit criteria:** every provider has documented capabilities, auth lifecycle, limits, failure modes, and tests. Do not claim feature parity without evidence.

## Phase 7 — Production hardening and release readiness

- Security/dependency review and threat-model updates.
- Backup and restore exercise.
- Monitoring, alerting, operational dashboards, and incident procedures.
- Load tests for pagination, sync concurrency, and attachment streaming.
- Verify deployment configuration, secrets, migrations, rollback, and recovery.
- Obtain explicit approval before production deployment or DNS/provider configuration changes.

**Exit criteria:** security findings are resolved or explicitly accepted; backup/restore and runbooks are tested; release checks pass; production deployment is separately approved.

## Phase governance

- One phase at a time; no skipping exit criteria.
- Every phase adds automated tests and updates relevant docs.
- Run and report lint, typecheck, tests, and builds; never claim checks that were not run.
- Review security, privacy, provider capability assumptions, and error handling in every phase.
- Stop and ask before changing scope, credentials, provider settings, data-retention policy, destructive behaviour, or production infrastructure.
