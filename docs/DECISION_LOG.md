# Decision Log

## Direction recorded
- D-001: Private organisation tool, not public SaaS.
- D-002: Integrate existing providers; no own mail server.
- D-003: GO54 first provider.
- D-004: Initial domain kpxacademy.com.ng and mailbox admin@kpxacademy.com.ng.
- D-005: Resend remains separate for transactional email.
- D-006: Provider is source of truth for email content/state initially.
- D-007: Planning stack React/TypeScript/Tailwind; Node 22/Express 5 ESM; PostgreSQL/Prisma.
- D-008: Planning deployment Vercel frontend, Render API/worker.

## Phase 0 decisions still open
- Monorepo vs separate frontend/backend repos.
- Local auth vs external identity; cookie/session vs JWT details.
- Encryption and key management implementation.
- Whether message metadata caching is needed.
- Worker/job mechanism and hosting arrangement.
- GO54 account-specific IMAP/SMTP access requirements.
- Owner/Admin automatic mailbox access vs explicit grants.
- Attachment streaming/storage strategy.
- Environment and test setup.

## Change record template
Date | Decision ID | Approved change | Rationale | Documents/implementation affected