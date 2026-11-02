# MailForge

Private, multi-domain email management for an organisation.

**Current status:** Blueprint approved. Phase 0 foundation is being defined; application code has not yet been implemented.

MailForge connects existing email providers and gives authorised staff one unified webmail and administration interface. It is not an email host and will not operate its own mail server.

## Product target

- Organisation: user's private organisation
- First domain: `kpxacademy.com.ng`
- First mailbox: `admin@kpxacademy.com.ng`
- First provider: GO54 Cloud Mail
- Resend remains separate for transactional application email.

## Product goals

- Manage multiple organisation-owned domains in one dashboard.
- Connect existing provider mailboxes.
- Assign staff and mailbox-level permissions.
- Read, compose, reply, forward, search, and organise email.
- Keep provider credentials and mailbox operations server-side.
- Add providers incrementally without claiming feature parity.

## Scope boundaries

**In scope:** staff access, domain/provider/mailbox administration, existing-provider integrations, unified webmail, security, audit, sync, and a responsive web app.

**Out of scope initially:** operating our own mail server, domain registrar/DNS management, public SaaS signup, billing, spam infrastructure, AI email features, calendar/contacts, and native mobile apps.

## Approved technology and architecture decisions

| Area | Decision |
|---|---|
| Language | TypeScript across frontend, API, and worker |
| Repository | npm-workspaces monorepo |
| Frontend | React + TypeScript + Tailwind CSS |
| Backend | Node.js 22 + Express 5 + ESM |
| Database | PostgreSQL + Prisma |
| API | REST, versioned under `/api/v1` |
| Authentication | Local authentication with secure, revocable cookie sessions |
| Provider integration | Provider adapter architecture; GO54 first |
| Credential encryption | AES-256-GCM; encryption keys held in deployment secrets/key management, never in the database or source control |
| Background work | Separate Node.js worker with durable job processing |
| Mailbox authorisation | Explicit user-to-mailbox grants; organisation role alone does not grant mailbox access |
| Planned hosting | Vercel frontend, Render API/worker, managed PostgreSQL |

These are architecture decisions, not permission to change production infrastructure, provider settings, DNS, or credentials.

## Core application architecture

### Monorepo layout

The initial workspace structure is:

```text
MailForge/
├── apps/
│   ├── web/                 # React application
│   ├── api/                 # Express HTTP API
│   └── worker/              # Background jobs and mailbox sync
├── packages/
│   ├── database/            # Prisma schema, migrations, repositories
│   ├── shared/              # Shared types, schemas, constants
│   ├── provider-core/       # Provider contracts and capability types
│   ├── provider-go54/       # GO54 IMAP/SMTP adapter
│   └── config/              # Shared TypeScript/tooling configuration
├── docs/
├── .github/workflows/
├── package.json
├── tsconfig.base.json
└── .env.example
```

Keep dependencies flowing in one direction: apps may use shared packages; provider implementations implement provider-core; shared packages must not import from apps.

### Backend request lifecycle

Every API request must follow a predictable pipeline:

1. Request ID and structured request context are attached.
2. Security headers, CORS, body-size limits, and rate limits are applied.
3. Route-level authentication identifies the active user/session.
4. Validation middleware parses and validates params, query, and body.
5. Authorisation checks organisation membership, resource ownership, and the required mailbox permission.
6. The controller calls the service through `asyncWrapper`.
7. The service applies business rules and calls repositories or provider adapters.
8. The controller returns the standard success response.
9. Unhandled errors flow to the final central error middleware.

Required shared API infrastructure:

- **`asyncWrapper`:** wraps async route handlers and forwards rejected promises to Express error handling. Do not scatter repetitive route-level `try/catch` blocks.
- **Not-found middleware:** handles unmatched routes and forwards a typed 404 error.
- **Central error middleware:** the final Express middleware; normalises known application, validation, Prisma, and provider errors into safe HTTP responses. It must not leak stack traces, credentials, provider secrets, or raw internal errors in production.
- **Typed application errors:** consistent error codes, HTTP status, safe message, and optional field-level details.
- **Response helpers:** one shared success-response format and one error-response format; controllers must not invent response shapes.
- **Validation layer:** schemas at the HTTP boundary; validated input, not raw request objects, reaches services.
- **Configuration validation:** fail fast at startup when required environment variables are missing or invalid. Never silently substitute insecure defaults.
- **Logging:** structured logs with request/correlation IDs and redaction for passwords, cookies, tokens, provider credentials, message bodies, and attachment contents.
- **Health endpoints:** liveness and readiness checks that do not disclose secrets or sensitive infrastructure details.

### Backend module structure

Each business module follows the same separation of concerns:

```text
modules/
└── mailboxes/
    ├── mailboxes.db.ts           # Persistence/repository operations
    ├── mailboxes.service.ts      # Business rules and orchestration
    ├── mailboxes.controller.ts   # HTTP request/response mapping
    ├── mailboxes.validator.ts    # Request schemas
    └── mailboxes.routes.ts       # Route definitions and middleware
```

Responsibilities:

- **Database/repository:** Prisma queries, persistence, and transaction boundaries. No HTTP objects or provider protocol logic.
- **Service:** business rules, permission-sensitive workflows, and provider orchestration. No Express request/response objects.
- **Controller:** thin HTTP adapter. No business logic or direct Prisma/provider calls.
- **Validator:** validates and transforms untrusted input at the boundary.
- **Routes:** compose authentication, validation, permission middleware, `asyncWrapper`, and controllers.

### Provider and data boundaries

- The frontend communicates only with the HTTPS API. It never connects directly to IMAP or SMTP.
- Services depend on a provider-neutral adapter contract, not GO54-specific code.
- Provider adapters expose capabilities explicitly; unsupported operations must be unavailable or return a clear capability error.
- The provider remains the source of truth for message bodies, attachments, folders, and mailbox state in the initial release.
- PostgreSQL stores organisation and application data, mailbox grants, encrypted provider connection details, audit records, and sync checkpoints.
- Do not cache full message bodies or attachments by default. Any later retention/cache design requires an explicit decision.
- IMAP UID values are folder-scoped and must be paired with UIDVALIDITY; sequence numbers are not durable identifiers.
- SMTP acceptance is not proof of delivery. Never blindly retry a send when the outcome is uncertain.

### Security baseline

- Enforce organisation and mailbox access on the server for every protected operation.
- Use secure, HttpOnly, appropriately SameSite cookies; implement CSRF protection for cookie-authenticated state-changing requests.
- Rotate and revoke sessions; rate-limit authentication and sensitive endpoints.
- Encrypt provider credentials using authenticated encryption and a managed key outside the database.
- Never expose provider credentials to the browser or write secrets/email content to logs.
- Treat email HTML and attachments as untrusted input; sanitise HTML and authorise/limit attachment streaming.
- Record security-relevant actions in audit logs without recording message bodies or secrets.

## Implementation phases

Phases are sequential. Do not start a later phase until the current phase's exit criteria are met and reviewed. Every phase includes tests, CI, documentation updates, security review, and a user review.

### Phase 0 — Engineering foundation and architecture

**Build first; do not skip this phase.**

1. Create npm-workspaces monorepo and workspace package boundaries.
2. Configure TypeScript strictness, Node.js 22 ESM, path/build conventions, formatting, linting, and scripts.
3. Establish the React web app, Express API app, and separate worker entry point.
4. Build API foundations before feature endpoints:
   - Express app/server separation and orderly startup/shutdown.
   - Environment schema and startup validation.
   - Request ID/correlation context and structured redacted logging.
   - Security headers, CORS policy, body-size limits, and rate-limit integration points.
   - Typed application error classes and error-code conventions.
   - `asyncWrapper` for async controllers.
   - Not-found middleware and final central error middleware.
   - Shared success/error response helpers.
   - Request validation conventions and reusable validation middleware.
   - Health/readiness endpoints.
5. Configure PostgreSQL, Prisma, schema/migration workflow, and database package.
6. Define provider-core interfaces and capability model; add a fake/in-memory provider for deterministic tests.
7. Configure test tooling and CI for clean install, lint, typecheck, tests, and builds.
8. Document environment variables in `.env.example`; use placeholders only, never real credentials.
9. Record the approved architecture decisions and exact local development commands.

**Exit criteria:** clean checkout installs and builds; lint/typecheck/tests pass in CI; API middleware behaviour is tested (async rejection, 404, typed errors, safe production errors, validation); Prisma schema and migration workflow are reproducible; fake provider contract tests pass; no secrets are committed. No production provider credentials or real email sends are needed in this phase.

### Phase 1 — Authentication and organisation access

1. Implement owner bootstrap without public registration.
2. Implement login, logout, session rotation/revocation, and current-user endpoint.
3. Add organisation, membership, role policy, and invitation lifecycle.
4. Hash invitation tokens; enforce expiry and single use.
5. Add audit events for authentication, invitations, membership, and role changes.
6. Build the minimum administration screens.

**Exit criteria:** owner can invite staff; invited staff can accept and sign in; revoked/expired sessions and invitations are rejected; organisation isolation and role checks are tested; there is no public signup.

### Phase 2 — Domains, provider connections, and mailboxes

1. Add organisation-owned domain records.
2. Add provider connection and mailbox records with same-organisation constraints.
3. Implement encrypted credential storage and key-version metadata.
4. Implement GO54 adapter configuration and separate IMAP and SMTP connectivity/authentication checks.
5. Register mailboxes and issue explicit mailbox access grants.
6. Add provider capability and connection-health reporting.

**Exit criteria:** IMAP and SMTP are validated independently; mailbox grants and organisation isolation are enforced; credential encryption/redaction tests pass; validation does not send a real email. GO54 account-level protocol availability must be confirmed before relying on it.

### Phase 3 — Inbox, folders, and reading

1. Implement provider-backed folder listing and capability-aware folder mapping.
2. Implement bounded, stable message pagination.
3. Implement message detail and safe HTML rendering/sanitisation.
4. Implement read/unread state where supported.
5. Implement authorised attachment metadata and bounded streaming.
6. Add sync checkpoints only where required; preserve UIDVALIDITY correctness.

**Exit criteria:** authorised staff can list folders and read messages; cross-mailbox access is denied; large responses and attachments are bounded; unsafe HTML is neutralised; provider failures are translated into safe, actionable errors.

### Phase 4 — Compose, reply, forward, and send

1. Implement compose/reply/forward with validated recipients and content.
2. Enforce attachment type/size limits and safe handling.
3. Send through GO54 SMTP using the mailbox's authorised provider connection.
4. Handle Sent-folder placement separately from SMTP acceptance.
5. Add idempotency/duplicate-send protection and an explicit uncertain-outcome state.

**Exit criteria:** an authorised user can send and reply end-to-end; provider acceptance is clearly distinguished from delivery; sent-folder behaviour is verified; uncertain sends are not blindly retried. Real email tests require explicit approval.

### Phase 5 — Mailbox productivity

1. Add provider-aware search.
2. Add flags, move, archive, trash, restore, and delete only where supported.
3. Add drafts, signatures, and user preferences where provider behaviour permits.
4. Improve sync scheduling, retry controls, and mailbox status visibility.
5. Complete responsive and accessibility refinements.

**Exit criteria:** operations map correctly to each provider's capabilities; destructive actions are confirmed and audited; sync is bounded and observable; unsupported operations are never represented as successful.

### Phase 6 — Additional provider adapters

1. Evaluate Google Workspace integration separately, including OAuth consent, scopes, token refresh/revocation, and Gmail API semantics.
2. Implement provider-specific adapters behind provider-core.
3. Add Microsoft 365/Graph only after its authentication and capability design is reviewed.
4. Add adapter contract tests and provider-specific integration tests.

**Exit criteria:** each provider has documented capabilities, auth lifecycle, limits, failure modes, and tests. No provider is advertised as feature-equivalent without evidence.

### Phase 7 — Production hardening and release readiness

1. Complete security and dependency review, threat-model updates, and penetration-test remediation.
2. Verify backups and perform a restore exercise.
3. Add monitoring, alerting, operational dashboards, and incident procedures.
4. Load-test pagination, sync concurrency, and attachment streaming.
5. Verify deployment configuration, secret management, migrations, rollback, and recovery procedures.
6. Obtain explicit approval before production deployment or any DNS/provider configuration changes.

**Exit criteria:** security findings are resolved or explicitly accepted; backup/restore and operational runbooks are tested; release checks pass; production deployment is separately approved.

## MVP success criterion

An authorised staff member signs in, opens the GO54 mailbox, reads a message, and sends a reply through MailForge without opening GO54 Webmail. The provider accepts the send and the sent message is reflected in the provider mailbox where supported.

## Documentation

- [Product Blueprint](docs/PRODUCT_BLUEPRINT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Database Design](docs/DATABASE_DESIGN.md)
- [API Contracts](docs/API_CONTRACTS.md)
- [Provider Integration](docs/PROVIDER_INTEGRATION.md)
- [Security](docs/SECURITY.md)
- [Frontend Architecture](docs/FRONTEND_ARCHITECTURE.md)
- [Implementation Roadmap](docs/IMPLEMENTATION_ROADMAP.md)
- [AI Implementation Guide](docs/AI_IMPLEMENTATION_GUIDE.md)
- [Decision Log](docs/DECISION_LOG.md)

## Non-negotiable engineering rules

1. Provider remains the source of truth for email content and mailbox state initially.
2. Every mailbox operation is permission-checked server-side.
3. Provider credentials never reach the browser and are never stored/logged in plaintext.
4. Provider capabilities differ; do not promise unsupported parity.
5. Email and attachments are untrusted input; sanitise and authorise access.
6. Keep the repository/database → service → controller → validator separation; controllers stay thin.
7. Use `asyncWrapper`, typed application errors, central error middleware, and shared response helpers from the beginning. These are foundation requirements, not later refactoring tasks.
8. Implement only the approved phase; meet its exit criteria before moving on.
9. Do not claim tests or CI pass unless they were actually run.
10. No production deployment, DNS changes, provider credential changes, real email tests, or destructive mailbox actions without explicit approval.

## Current progress

- [x] Repository created
- [x] Blueprint documentation reviewed
- [x] Core technology and architecture direction approved
- [x] Phase sequence and foundation requirements defined
- [ ] Phase 0 implementation
- [ ] Phase 1 authentication and organisation
- [ ] Phase 2 GO54 provider/mailboxes
- [ ] Phase 3 inbox and reading
- [ ] Phase 4 compose and sending
- [ ] Phase 5 productivity
- [ ] Phase 6 additional providers
- [ ] Phase 7 production hardening

MailForge is a working name; verify naming/domain/trademark availability before public launch.
