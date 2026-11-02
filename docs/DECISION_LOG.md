# Decision Log

## Approved direction

- D-001: MailForge is a private organisation tool, not public SaaS.
- D-002: Integrate existing providers; do not operate an own mail server.
- D-003: GO54 Cloud Mail is the first provider.
- D-004: Initial domain is `kpxacademy.com.ng`; initial mailbox is `admin@kpxacademy.com.ng`.
- D-005: Resend remains separate for transactional application email.
- D-006: Provider is the source of truth for email content and mailbox state initially.
- D-007: Use React + TypeScript + Tailwind; Node.js 22 + Express 5 + ESM; PostgreSQL + Prisma.
- D-008: Planned hosting is Vercel frontend, Render API/worker, and managed PostgreSQL. Production setup still requires explicit approval.
- D-009: Use a TypeScript npm-workspaces monorepo with separate web, API, and worker applications plus shared packages.
- D-010: Use local authentication with secure, revocable cookie sessions; no public registration.
- D-011: Use provider-neutral adapters, with GO54 first and provider capability differences explicit.
- D-012: Encrypt provider credentials with AES-256-GCM; keep keys in external deployment secrets/key management, not in the database or source control.
- D-013: Use a separate worker with durable background job processing.
- D-014: Require explicit user-to-mailbox permission grants; organisation role alone does not imply mailbox access.
- D-015: Establish `asyncWrapper`, typed application errors, not-found middleware, final central error middleware, shared response helpers, validation, redacted logging, and health/readiness checks in Phase 0. These are baseline architecture, not optional later improvements.
- D-016: Phase sequence is 0 Foundation; 1 Authentication/organisation; 2 Domains/provider/mailboxes; 3 Inbox/reading; 4 Compose/send; 5 Productivity; 6 Additional providers; 7 Production hardening/release readiness.

## Open implementation details

These details must be resolved during the relevant phase before implementation depends on them:

- Exact session store and cookie/CSRF configuration.
- Concrete key-management provider, key rotation procedure, and key versioning implementation.
- Durable queue technology and worker hosting details.
- Whether message metadata caching is needed and its retention/invalidation policy.
- GO54 account-specific IMAP/SMTP enablement and operational limits.
- Attachment streaming/storage approach and size limits.
- Exact test database and CI service setup.
- Deployment-specific CORS origins, secrets, and operational settings.

## Change record template

Date | Decision ID | Approved change | Rationale | Documents/implementation affected
