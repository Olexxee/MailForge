# Architecture

React/TypeScript frontend → HTTPS API → Node 22 / Express 5 → feature services → provider adapters → GO54 IMAP/SMTP. PostgreSQL/Prisma stores organisation and operational data. A worker handles sync/health checks. Frontend must never connect directly to IMAP/SMTP.

## Backend module structure

Use a feature-based, layered module architecture. Every HTTP business feature owns these five files in the same directory, with the singular `.route.ts` suffix:

```text
apps/api/src/modules/
├── auth/
│   ├── auth.db.ts
│   ├── auth.service.ts
│   ├── auth.controller.ts
│   ├── auth.route.ts
│   └── auth.validator.ts
├── domains/
│   ├── domains.db.ts
│   ├── domains.service.ts
│   ├── domains.controller.ts
│   ├── domains.route.ts
│   └── domains.validator.ts
└── mailboxes/
    ├── mailboxes.db.ts
    ├── mailboxes.service.ts
    ├── mailboxes.controller.ts
    ├── mailboxes.route.ts
    └── mailboxes.validator.ts
```

The same convention applies to users, organisations, provider connections, folders, messages, attachments, and future HTTP features.

### Layer responsibilities

- **`*.db.ts`** — Prisma queries, persistence, and transaction boundaries. No HTTP objects or provider protocol orchestration.
- **`*.service.ts`** — business rules, permission-sensitive workflows, and provider orchestration. Must not depend on Express request/response objects.
- **`*.controller.ts`** — thin HTTP adapter that maps validated input and service results to standard responses. No business rules or direct Prisma/provider calls.
- **`*.route.ts`** — endpoint declarations and middleware composition (authentication, validation, authorisation, `asyncWrapper`, controller). Keep routes thin.
- **`*.validator.ts`** — request schemas and parsing for route params, query strings, and request bodies. Raw unvalidated request input must not reach services.

Keep feature layers together; do not split all controllers, services, and database files into global layer directories. Shared infrastructure belongs in dedicated top-level directories such as middleware, errors, config, and utils. Infrastructure-only modules that do not expose HTTP endpoints need not contain empty controller/route/validator files; document justified exceptions.

## Request and error handling

Use `asyncWrapper` for async controller handlers. Errors flow to typed application errors and the final central Express error middleware. Include not-found middleware, shared success/error response helpers, startup environment validation, request IDs, structured redacted logs, security headers, CORS, body limits, rate limiting, and health/readiness endpoints from Phase 0. Avoid repetitive route-level try/catch; catch only at explicit recovery boundaries.

## Provider adapter

Services must not directly depend on GO54 protocol code. Define adapter interface during Phase 0 for validation, capabilities, folders, paginated messages, message details, attachments, sending, flags, move/archive/trash/delete when supported, and sync. Capability flags must reflect provider differences; Gmail labels are not identical to IMAP folders.

## Data ownership

Provider is source of truth for message bodies, attachments, folders, and mailbox state. Local DB stores organisation, users, domains, provider connections, mailbox access, encrypted credentials, and sync state. Do not replicate full mail bodies/attachments for MVP without approved retention design.

## Sync

Use worker for sync/health. Bounded retries, provider limits, per-mailbox concurrency control, correct UIDVALIDITY checkpoints. Never blindly retry sends.

## Deployment

Vercel frontend, Render API/worker, PostgreSQL. Keep API and worker separable. No production deployment without approval.
