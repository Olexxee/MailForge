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

- Organisation-owned domain records with TXT ownership challenges, verification, and challenge rotation.
- Same-organisation composite constraints for domains, provider connections, mailboxes, and mailbox grants.
- Versioned AES-256-GCM credential encryption with a configurable keyring.
- GO54 adapter using trusted server-side host settings; separate IMAP and SMTP checks with strict TLS and bounded timeouts.
- Mailbox registration restricted to verified domains, explicit hierarchical grants, grant revocation, and health reporting.
- Organisation membership deactivation revokes mailbox grants and protects the last mailbox administrator.
- Administration UI for domains, mailbox connection, protocol validation, and mailbox grants.

**Exit criteria:** Prisma migration applies on a clean database; domain verification is exact and race-safe; IMAP and SMTP checks are independent; mailbox and organisation isolation are enforced; credential encryption/key rotation/redaction tests pass; deactivation and last-admin protections pass; validation sends no real email. Confirm the exact GO54 account-level endpoints and protocol availability before real validation.

## Phase 3 — Inbox, folders, and reading

- [x] Add provider-neutral folder, message summary, message page, and message detail contracts.
- [x] Implement GO54 folder listing and read-only IMAP message retrieval.
- [x] Implement bounded UID pagination with UIDVALIDITY-bound cursors; stale cursors fail closed.
- [x] Add mailbox-scoped API routes with explicit READ-grant enforcement and no-store responses.
- [x] Sanitise HTML server-side using a strict allow-list; do not render remote images or active content.
- [x] Bound each text/html body-part fetch to 256 KiB; return attachment metadata only.
- [ ] Build and verify the inbox UI against the read endpoints.
- [ ] Add provider adapter tests for folder/message pagination, UIDVALIDITY changes, body bounds, and safe failure mapping.
- [ ] Implement authorised, bounded attachment streaming as a separately tested increment.
- [ ] Add read/unread mutation only after permission and provider semantics are defined.
- [ ] Add sync checkpoints only where required; preserve UIDVALIDITY correctness.

**Exit criteria:** authorised users can list folders and read messages; cross-mailbox access is denied; content/attachments are bounded; unsafe HTML is neutralised; provider failures are safely mapped. Live GO54 validation remains a separate operational check and is not required for deterministic CI.

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
